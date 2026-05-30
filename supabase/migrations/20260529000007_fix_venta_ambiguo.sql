-- Fix: "column reference \"folio\" is ambiguous" en registrar_venta.
-- El nombre de salida `folio` chocaba con ventas.folio en el RETURNING.
-- Se califica la columna como ventas.folio.

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

  for it in select * from jsonb_array_elements(p_items) loop
    v_prod := (it->>'producto_id')::uuid;
    v_cant := (it->>'cantidad')::numeric;
    v_precio := (it->>'precio_unit')::numeric;
    if v_cant <= 0 then raise exception 'Cantidad inválida.'; end if;
    select coalesce(sum(cantidad_actual), 0) into v_disp from lotes where producto_id = v_prod;
    if v_disp < v_cant then
      raise exception 'Stock insuficiente para "%": disponible %, requerido %',
        (select nombre from productos where id = v_prod), v_disp, v_cant;
    end if;
    v_total := v_total + v_cant * v_precio;
  end loop;

  insert into ventas (paciente_id, usuario_id, subtotal, total, metodo_pago, estado)
  values (p_paciente, v_usuario, v_total, v_total, p_metodo, 'pagada')
  returning id, ventas.folio into v_venta, v_folio;

  for it in select * from jsonb_array_elements(p_items) loop
    v_prod := (it->>'producto_id')::uuid;
    v_cant := (it->>'cantidad')::numeric;
    v_precio := (it->>'precio_unit')::numeric;

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

  insert into pagos (venta_id, monto, metodo) values (v_venta, v_total, p_metodo);

  return query select v_venta, v_folio;
end;
$$;
