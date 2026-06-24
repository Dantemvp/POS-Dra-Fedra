-- ============================================================================
-- Cancelar cobro (marcado, reversible) para admin / doctora / GERENTE.
--   - cobros.estado: 'activo' | 'cancelado' (no se borra el registro)
--   - cancelar_cobro(): valida rol, revierte el stock de los productos del cobro
--     (devuelve a los lotes + movimiento 'entrada'), y marca el cobro cancelado.
--   - Queda en la bitácora (Movimientos) automáticamente: el trigger de auditoría
--     registra el UPDATE de cobros (antes→después: activo→cancelado).
--   - El borrado físico (eliminar_cobro) sigue siendo admin/doctora.
-- ============================================================================

alter table cobros add column if not exists estado text not null default 'activo';

create or replace function public.cancelar_cobro(p_cobro uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid;
  v_rol     rol_usuario;
  v_estado  text;
  mv        record;
begin
  select id, rol into v_usuario, v_rol from usuarios where auth_uid = auth.uid();
  if v_usuario is null then
    raise exception 'No se encontró el usuario de la sesión.';
  end if;
  if v_rol::text not in ('admin','doctora','gerente') then
    raise exception 'No tienes permiso para cancelar cobros.';
  end if;

  select estado into v_estado from cobros where id = p_cobro;
  if v_estado is null then raise exception 'Cobro no encontrado.'; end if;
  if v_estado <> 'activo' then raise exception 'El cobro ya está cancelado.'; end if;

  -- Devolver al inventario lo que el cobro descontó (por lote exacto) + traza.
  for mv in
    select producto_id, lote_id, cantidad from movimientos_inv
    where referencia_id = p_cobro::text and tipo = 'salida' and lote_id is not null
  loop
    update lotes set cantidad_actual = cantidad_actual + mv.cantidad where id = mv.lote_id;
    insert into movimientos_inv (producto_id, lote_id, tipo, cantidad, motivo, referencia_id, usuario_id)
    values (mv.producto_id, mv.lote_id, 'entrada', mv.cantidad, 'Cancelación de cobro', p_cobro::text, v_usuario);
  end loop;

  update cobros set estado = 'cancelado' where id = p_cobro;
end;
$$;

grant execute on function public.cancelar_cobro(uuid) to authenticated;
