-- ============================================================================
-- Cobros que incluyen productos del inventario (no solo servicios)
--   - cobro_items.producto_id  → liga al catálogo de productos
--   - RPC registrar_cobro(): atómico. Inserta cobro + items (servicios y
--     productos) + descuenta stock FIFO de los productos + registra el pago.
--     security definer: la doctora/asistente no tienen RLS sobre lotes, así
--     que la función (de confianza) hace el descuento validando el rol primero.
-- ============================================================================

alter table cobro_items add column if not exists producto_id uuid references productos(id);
create index if not exists ix_cobroitems_producto on cobro_items(producto_id);

create or replace function public.registrar_cobro(
  p_paciente uuid,
  p_metodo   metodo_pago,
  p_nota     text,
  p_items    jsonb   -- [{tipo:'servicio'|'producto', servicio_id, producto_id, descripcion, cantidad, precio_unit}]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid;
  v_rol     rol_usuario;
  v_cobro   uuid;
  v_total   numeric := 0;
  it        jsonb;
  agg       record;
  lote_rec  record;
  v_prod    uuid;
  v_cant    numeric;
  v_precio  numeric;
  v_disp    numeric;
  restante  numeric;
  deducir   numeric;
begin
  select id, rol into v_usuario, v_rol from usuarios where auth_uid = auth.uid();
  if v_usuario is null then
    raise exception 'No se encontró el usuario de la sesión.';
  end if;
  if v_rol not in ('doctora','asistente','admin') then
    raise exception 'No tienes permiso para registrar cobros.';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'El cobro no tiene conceptos.';
  end if;

  -- Validar stock agregado de los productos
  for agg in
    select (e->>'producto_id')::uuid as pid, sum((e->>'cantidad')::numeric) as cant
    from jsonb_array_elements(p_items) e
    where e->>'tipo' = 'producto' and e->>'producto_id' is not null
    group by 1
  loop
    select coalesce(sum(cantidad_actual),0) into v_disp from lotes where producto_id = agg.pid;
    if v_disp < agg.cant then
      raise exception 'Stock insuficiente para "%": disponible %, requerido %',
        (select nombre from productos where id = agg.pid), v_disp, agg.cant;
    end if;
  end loop;

  -- Total
  for it in select * from jsonb_array_elements(p_items) loop
    v_total := v_total + coalesce((it->>'cantidad')::numeric,1) * coalesce((it->>'precio_unit')::numeric,0);
  end loop;

  insert into cobros (paciente_id, fecha, total, nota, doctora_id)
  values (p_paciente, now(), v_total, nullif(p_nota,''), v_usuario)
  returning id into v_cobro;

  -- Renglones
  for it in select * from jsonb_array_elements(p_items) loop
    v_cant   := coalesce((it->>'cantidad')::numeric,1);
    v_precio := coalesce((it->>'precio_unit')::numeric,0);

    insert into cobro_items (cobro_id, servicio_id, producto_id, descripcion, cantidad, precio_unit, subtotal)
    values (
      v_cobro,
      nullif(it->>'servicio_id','')::uuid,
      nullif(it->>'producto_id','')::uuid,
      nullif(it->>'descripcion',''),
      v_cant, v_precio, v_cant * v_precio
    );

    -- Descontar inventario FIFO si es producto
    if it->>'tipo' = 'producto' and it->>'producto_id' is not null then
      v_prod := (it->>'producto_id')::uuid;
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
        values (v_prod, lote_rec.id, 'salida', deducir, 'Cobro consultorio', v_cobro::text, v_usuario);
        restante := restante - deducir;
      end loop;
    end if;
  end loop;

  if v_total > 0 then
    insert into cobro_pagos (cobro_id, monto, metodo) values (v_cobro, v_total, p_metodo);
  end if;

  return v_cobro;
end;
$$;

grant execute on function public.registrar_cobro(uuid, metodo_pago, text, jsonb) to authenticated;
