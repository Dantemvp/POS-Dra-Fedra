-- ============================================================================
-- Eliminar una compra (solo admin). Revierte el inventario que agregó SIEMPRE
-- que no se haya consumido nada de sus lotes (si ya se vendió/movió, se bloquea
-- para no descuadrar el stock; en ese caso ajustar manualmente).
-- ============================================================================
create or replace function public.eliminar_compra(p_compra uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol rol_usuario;
  ci    record;
begin
  select rol into v_rol from usuarios where auth_uid = auth.uid();
  if v_rol is null or v_rol <> 'admin' then
    raise exception 'Solo el administrador puede eliminar compras.';
  end if;

  -- Verificar que ningún lote de la compra se haya consumido.
  for ci in
    select i.lote_id, i.cantidad, l.cantidad_actual
    from compra_items i join lotes l on l.id = i.lote_id
    where i.compra_id = p_compra and i.lote_id is not null
  loop
    if ci.cantidad_actual < ci.cantidad then
      raise exception 'No se puede eliminar: ya se usó stock de esta compra. Ajusta el inventario manualmente.';
    end if;
    -- ¿Hay salidas/mermas ligadas a ese lote?
    if exists (
      select 1 from movimientos_inv
      where lote_id = ci.lote_id and tipo in ('salida','merma')
    ) then
      raise exception 'No se puede eliminar: hay movimientos de salida en sus lotes.';
    end if;
  end loop;

  -- Borrar movimientos de la compra y de sus lotes
  delete from movimientos_inv
    where referencia_id = p_compra::text
       or lote_id in (select lote_id from compra_items where compra_id = p_compra and lote_id is not null);

  -- Borrar lotes creados por la compra
  delete from lotes
    where id in (select lote_id from compra_items where compra_id = p_compra and lote_id is not null);

  -- Borrar items y la compra
  delete from compra_items where compra_id = p_compra;
  delete from compras where id = p_compra;
end;
$$;

grant execute on function public.eliminar_compra(uuid) to authenticated;
