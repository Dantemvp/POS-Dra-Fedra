-- ============================================================================
-- Fix: "Database error saving new user".
-- Los triggers SECURITY DEFINER (handle_new_user, fn_audit) se ejecutan como
-- el rol `postgres`, que NO hace bypass de RLS en Supabase. Sus INSERT eran
-- bloqueados por RLS. Solución: políticas permisivas dirigidas al rol `postgres`
-- en las tablas que escriben los triggers (usuarios, audit_log).
-- El rol `postgres` solo lo usan funciones definer/migraciones, NUNCA la API
-- pública (anon/authenticated), por lo que no abre ningún hueco de seguridad.
-- ============================================================================

-- Permite al trigger de Auth crear/leer el perfil
drop policy if exists "postgres_gestiona_usuarios" on public.usuarios;
create policy "postgres_gestiona_usuarios" on public.usuarios
  as permissive for all
  to postgres
  using (true) with check (true);

-- Permite a fn_audit() escribir la bitácora
drop policy if exists "postgres_escribe_audit" on public.audit_log;
create policy "postgres_escribe_audit" on public.audit_log
  as permissive for all
  to postgres
  using (true) with check (true);

-- Función robusta (nombre nunca null)
create or replace function public.handle_new_user()
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
    coalesce(
      nullif(new.raw_user_meta_data->>'nombre', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Usuario'
    ),
    case when primer then 'admin' else 'asistente' end
  )
  on conflict (auth_uid) do nothing;
  return new;
end;
$$;
