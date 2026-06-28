-- ============================================================================
-- registrar_venta v3 — pagos mixtos (efectivo + tarjeta en una misma venta).
--
-- Cambios vs. v2 (mig. 016/029):
--   * Nuevo parámetro OPCIONAL `p_pagos jsonb` = [{"metodo":"efectivo","monto":n}, ...].
--     - Si es NULL (llamada vieja del POS): comportamiento idéntico — un solo
--       pago con p_metodo. 100% retrocompatible.
--     - Si viene: se valida que la suma de montos cuadre con el total calculado
--       en el servidor, y se inserta una fila en `pagos` por cada método.
--   * ventas.metodo_pago: un solo método si hay un pago; NULL si es mixto
--     (la verdad por método vive en `pagos`; el corte de caja suma desde ahí).
--
-- Toda la lógica de stock, precio-servidor, FIFO por caducidad y movimientos
-- de inventario queda IDÉNTICA a la v2. Atómica (security invoker).
--
-- Se hace DROP de la firma de 3 args antes de crear la de 4 (con default) para
-- no dejar dos sobrecargas que vuelvan ambigua la llamada del POS.
-- ============================================================================

drop function if exists public.registrar_venta(jsonb, metodo_pago, uuid);

create or replace function public.registrar_venta(
  p_items jsonb,
  p_metodo metodo_pago,
  p_paciente uuid default null,
  p_pagos jsonb default null
)
returns table(venta_id uuid, folio bigint)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_usuario uuid;
  v_venta uuid;
  v_folio bigint;
  v_total numeric := 0;
  it jsonb;
  v_prod uuid;
  v_cant numeric;
  v_precio numeric;
  v_disp numeric;
  agg record;
  lote_rec record;
  restante numeric;
  deducir numeric;
  -- Pagos
  v_pago jsonb;
  v_suma_pagos numeric := 0;
  v_num_pagos int := 0;
  v_metodo_cabecera metodo_pago;
begin
  select id into v_usuario from usuarios where auth_uid = auth.uid();
  if v_usuario is null then
    raise exception 'No se encontró el usuario de la sesión.';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta no tiene productos.';
  end if;

  -- Validar stock AGREGANDO la cantidad por producto (renglones repetidos suman).
  for agg in
    select (e->>'producto_id')::uuid as pid,
           sum((e->>'cantidad')::numeric) as cant
    from jsonb_array_elements(p_items) e
    group by 1
  loop
    if agg.cant <= 0 then raise exception 'Cantidad inválida.'; end if;
    select coalesce(sum(cantidad_actual), 0) into v_disp
      from lotes where producto_id = agg.pid;
    if v_disp < agg.cant then
      raise exception 'Stock insuficiente para "%": disponible %, requerido %',
        (select nombre from productos where id = agg.pid), v_disp, agg.cant;
    end if;
  end loop;

  -- Total con precio del catálogo (no del cliente).
  for it in select * from jsonb_array_elements(p_items) loop
    v_prod := (it->>'producto_id')::uuid;
    v_cant := (it->>'cantidad')::numeric;
    select precio_venta into v_precio from productos where id = v_prod and activo = true;
    if v_precio is null then
      raise exception 'Producto no encontrado o inactivo.';
    end if;
    v_total := v_total + v_cant * v_precio;
  end loop;

  -- Resolver método de cabecera y validar pagos mixtos (si vienen).
  if p_pagos is not null and jsonb_array_length(p_pagos) > 0 then
    v_num_pagos := jsonb_array_length(p_pagos);
    for v_pago in select * from jsonb_array_elements(p_pagos) loop
      if (v_pago->>'monto')::numeric <= 0 then
        raise exception 'Cada pago debe tener un monto mayor a cero.';
      end if;
      v_suma_pagos := v_suma_pagos + (v_pago->>'monto')::numeric;
    end loop;
    if abs(v_suma_pagos - v_total) > 0.01 then
      raise exception 'Los pagos suman %, pero el total es %.', v_suma_pagos, v_total;
    end if;
    -- Un solo método → ese método en la cabecera; varios → NULL (mixto).
    if v_num_pagos = 1 then
      v_metodo_cabecera := (p_pagos->0->>'metodo')::metodo_pago;
    else
      v_metodo_cabecera := null;
    end if;
  else
    v_metodo_cabecera := p_metodo;
  end if;

  -- Cabecera de venta
  insert into ventas (paciente_id, usuario_id, subtotal, total, metodo_pago, estado)
  values (p_paciente, v_usuario, v_total, v_total, v_metodo_cabecera, 'pagada')
  returning id, ventas.folio into v_venta, v_folio;

  -- Detalle + descuento de inventario (FIFO) + movimientos
  for it in select * from jsonb_array_elements(p_items) loop
    v_prod := (it->>'producto_id')::uuid;
    v_cant := (it->>'cantidad')::numeric;
    select precio_venta into v_precio from productos where id = v_prod;

    insert into venta_items (venta_id, producto_id, cantidad, precio_unit)
    values (v_venta, v_prod, v_cant, v_precio);

    restante := v_cant;
    for lote_rec in
      select id, cantidad_actual from lotes
      where producto_id = v_prod and cantidad_actual > 0
      order by caducidad asc nulls last, creado_en asc
    loop
      exit when restante <= 0;
      deducir := least(restante, lote_rec.cantidad_actual);
      update lotes set cantidad_actual = cantidad_actual - deducir where id = lote_rec.id;
      insert into movimientos_inv (producto_id, lote_id, tipo, cantidad, motivo, referencia_id, usuario_id)
      values (v_prod, lote_rec.id, 'salida', deducir, 'Venta', v_venta::text, v_usuario);
      restante := restante - deducir;
    end loop;
  end loop;

  -- Pagos: uno por método si es mixto; si no, un solo pago con el total.
  if p_pagos is not null and jsonb_array_length(p_pagos) > 0 then
    for v_pago in select * from jsonb_array_elements(p_pagos) loop
      insert into pagos (venta_id, monto, metodo)
      values (v_venta, (v_pago->>'monto')::numeric, (v_pago->>'metodo')::metodo_pago);
    end loop;
  else
    insert into pagos (venta_id, monto, metodo) values (v_venta, v_total, p_metodo);
  end if;

  return query select v_venta, v_folio;
end;
$$;

-- El DROP de arriba elimina los permisos de la función previa; re-otorgamos
-- EXECUTE explícito a authenticated para garantizar que el POS pueda cobrar
-- (defensivo: no dependemos del EXECUTE por defecto de PUBLIC).
grant execute on function public.registrar_venta(jsonb, metodo_pago, uuid, jsonb) to authenticated;
