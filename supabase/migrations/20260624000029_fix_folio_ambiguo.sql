-- ============================================================================
-- FIX: "column reference \"folio\" is ambiguous" al cobrar en el Punto de venta.
-- registrar_venta v2 (mig. 016) reintrodujo el bug: el RETURNS TABLE declara una
-- columna de salida `folio`, y el RETURNING usaba `folio` sin calificar → choca
-- con la columna ventas.folio. Se califica como ventas.folio. (Igual que el fix
-- original de la v1 en la mig. 007.) Resto del cuerpo idéntico a la v2.
-- ============================================================================

create or replace function public.registrar_venta(
  p_items jsonb,
  p_metodo metodo_pago,
  p_paciente uuid default null
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

  -- Cabecera de venta
  insert into ventas (paciente_id, usuario_id, subtotal, total, metodo_pago, estado)
  values (p_paciente, v_usuario, v_total, v_total, p_metodo, 'pagada')
  returning id, ventas.folio into v_venta, v_folio;  -- ← calificado: evita ambigüedad

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

  -- Pago
  insert into pagos (venta_id, monto, metodo) values (v_venta, v_total, p_metodo);

  return query select v_venta, v_folio;
end;
$$;
