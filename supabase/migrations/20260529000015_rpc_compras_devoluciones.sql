-- ============================================================================
-- RPCs atómicas: cancelar_venta (devoluciones) y registrar_compra.
-- ============================================================================

-- Cancela/devuelve una venta: regresa el inventario y marca la venta cancelada.
create or replace function public.cancelar_venta(p_venta uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_usuario uuid;
  v_estado estado_venta;
  mov record;
begin
  select id into v_usuario from usuarios where auth_uid = auth.uid();
  if v_usuario is null then raise exception 'No se encontró el usuario.'; end if;

  select estado into v_estado from ventas where id = p_venta;
  if v_estado is null then raise exception 'Venta no encontrada.'; end if;
  if v_estado <> 'pagada' then raise exception 'La venta no está activa.'; end if;

  -- Revertir cada salida de inventario de esta venta
  for mov in
    select lote_id, cantidad, producto_id
    from movimientos_inv
    where referencia_id = p_venta::text and tipo = 'salida'
  loop
    if mov.lote_id is not null then
      update lotes set cantidad_actual = cantidad_actual + mov.cantidad
      where id = mov.lote_id;
    end if;
    insert into movimientos_inv (producto_id, lote_id, tipo, cantidad, motivo, referencia_id, usuario_id)
    values (mov.producto_id, mov.lote_id, 'entrada', mov.cantidad, 'Cancelación de venta', p_venta::text, v_usuario);
  end loop;

  update ventas set estado = 'cancelada' where id = p_venta;
end;
$$;

-- Registra una compra a proveedor: crea proveedor (si nuevo), compra, items,
-- lotes y movimientos de entrada. Todo en una transacción.
create or replace function public.registrar_compra(
  p_proveedor text,
  p_factura text,
  p_fecha date,
  p_items jsonb   -- [{"producto_id":uuid,"cantidad":n,"costo":n,"lote":"","caducidad":""}]
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_usuario uuid;
  v_prov uuid;
  v_compra uuid;
  v_total numeric := 0;
  it jsonb;
  v_lote uuid;
  v_prod uuid;
  v_cant numeric;
  v_costo numeric;
begin
  select id into v_usuario from usuarios where auth_uid = auth.uid();
  if v_usuario is null then raise exception 'No se encontró el usuario.'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'La compra no tiene productos.';
  end if;

  if coalesce(trim(p_proveedor), '') <> '' then
    select id into v_prov from proveedores where nombre = trim(p_proveedor) limit 1;
    if v_prov is null then
      insert into proveedores (nombre) values (trim(p_proveedor)) returning id into v_prov;
    end if;
  end if;

  for it in select * from jsonb_array_elements(p_items) loop
    v_total := v_total
      + coalesce((it->>'cantidad')::numeric, 0) * coalesce(nullif(it->>'costo','')::numeric, 0);
  end loop;

  insert into compras (proveedor_id, factura, fecha, total, usuario_id)
  values (v_prov, nullif(trim(coalesce(p_factura, '')), ''), coalesce(p_fecha, current_date), v_total, v_usuario)
  returning id into v_compra;

  for it in select * from jsonb_array_elements(p_items) loop
    v_prod := (it->>'producto_id')::uuid;
    v_cant := nullif(it->>'cantidad','')::numeric;
    v_costo := nullif(it->>'costo','')::numeric;
    if v_prod is null or v_cant is null or v_cant <= 0 then continue; end if;

    insert into lotes (producto_id, lote, caducidad, cantidad_actual, costo)
    values (v_prod, nullif(it->>'lote',''), nullif(it->>'caducidad','')::date, v_cant, v_costo)
    returning id into v_lote;

    insert into compra_items (compra_id, producto_id, lote_id, cantidad, costo_unit)
    values (v_compra, v_prod, v_lote, v_cant, v_costo);

    insert into movimientos_inv (producto_id, lote_id, tipo, cantidad, motivo, referencia_id, usuario_id)
    values (v_prod, v_lote, 'entrada', v_cant, 'Compra', v_compra::text, v_usuario);
  end loop;

  return v_compra;
end;
$$;
