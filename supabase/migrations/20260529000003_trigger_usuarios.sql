-- ============================================================================
-- Auto-perfil de usuario al registrarse en Supabase Auth.
-- Cuando se crea un usuario en auth.users, se crea su fila en `usuarios`.
-- La PRIMERA cuenta registrada queda como 'admin'; las demás como 'asistente'
-- (el admin luego reasigna roles).
-- ============================================================================

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  primer boolean;
begin
  select count(*) = 0 into primer from public.usuarios;

  insert into public.usuarios (auth_uid, email, nombre, rol)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    case when primer then 'admin' else 'asistente' end
  )
  on conflict (auth_uid) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
