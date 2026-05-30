-- ============================================================================
-- Fix real de "Database error creating new user".
-- Causa: el CASE devuelve `text` y la columna `rol` es enum `rol_usuario`.
-- Postgres no castea text->enum implícitamente en una expresión CASE.
-- Solución: castear explícitamente con ::rol_usuario.
-- ============================================================================

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
    (case when primer then 'admin' else 'asistente' end)::rol_usuario
  )
  on conflict (auth_uid) do nothing;
  return new;
end;
$$;
