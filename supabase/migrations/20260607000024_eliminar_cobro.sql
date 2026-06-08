-- ============================================================================
-- Eliminar un cobro (solo admin o doctora). La asistente NO puede borrar cobros
-- directamente: si se equivocó, lo reporta a la Dra/admin (control sin construir
-- un flujo de aprobación pesado; el audit_log guarda el registro del borrado).
-- Revierte el stock de los productos con precisión usando los movimientos
-- 'salida' que generó ese cobro.
-- ============================================================================
create or replace function public.eliminar_cobro(p_cobro uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol rol_usuario;
  mv    record;
begin
  select rol into v_rol from usuarios where auth_uid = auth.uid();
  if v_rol is null or v_rol not in ('admin','doctora') then
    raise exception 'Solo la doctora o el administrador pueden eliminar cobros.';
  end if;

  -- Devolver al inventario lo que el cobro descontó (por lote exacto).
  for mv in
    select lote_id, cantidad from movimientos_inv
    where referencia_id = p_cobro::text and tipo = 'salida' and lote_id is not null
  loop
    update lotes set cantidad_actual = cantidad_actual + mv.cantidad where id = mv.lote_id;
  end loop;

  delete from movimientos_inv where referencia_id = p_cobro::text;
  delete from cobro_pagos  where cobro_id = p_cobro;
  delete from cobro_items  where cobro_id = p_cobro;
  delete from cobros       where id = p_cobro;
end;
$$;

grant execute on function public.eliminar_cobro(uuid) to authenticated;
