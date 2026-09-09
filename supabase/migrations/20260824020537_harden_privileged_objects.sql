-- La vista debe evaluar RLS con el usuario que consulta, no con su creador.
alter view public.libro_control set (security_invoker = true);
revoke all on table public.libro_control from public, anon, authenticated;
grant select on table public.libro_control to authenticated;

-- Los helpers de autorización resuelven objetos por nombre totalmente
-- calificado y no aceptan un search_path controlable por el llamador.
create or replace function public.current_rol()
returns public.rol_usuario
language sql
stable
security definer
set search_path = ''
as $$
  select u.rol
  from public.usuarios u
  where u.auth_uid = (select auth.uid())
  limit 1;
$$;

create or replace function public.es_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select public.current_rol() = 'admin'::public.rol_usuario;
$$;

-- PostgreSQL concede EXECUTE a PUBLIC por defecto. Las funciones trigger no
-- son endpoints RPC; las demás solo pueden invocarlas sesiones autenticadas y
-- conservan sus validaciones internas de rol.
revoke execute on function public.fn_audit() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

revoke execute on function public.current_rol() from public, anon;
grant execute on function public.current_rol() to authenticated;

revoke execute on function public.cancelar_cobro(uuid) from public, anon;
grant execute on function public.cancelar_cobro(uuid) to authenticated;

revoke execute on function public.eliminar_cobro(uuid) from public, anon;
grant execute on function public.eliminar_cobro(uuid) to authenticated;

revoke execute on function public.eliminar_compra(uuid) from public, anon;
grant execute on function public.eliminar_compra(uuid) to authenticated;

revoke execute on function public.productos_de_receta(bigint) from public, anon;
grant execute on function public.productos_de_receta(bigint) to authenticated;

revoke execute on function public.registrar_cobro(uuid, public.metodo_pago, text, jsonb) from public, anon;
grant execute on function public.registrar_cobro(uuid, public.metodo_pago, text, jsonb) to authenticated;
