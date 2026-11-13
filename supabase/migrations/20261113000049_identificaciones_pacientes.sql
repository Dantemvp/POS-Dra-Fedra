-- Preparación para revisión. No aplicar a producción sin autorización.
-- No modifica pacientes, historias, roles de aplicación ni otros buckets.
begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('identificaciones-pacientes', 'identificaciones-pacientes', false, 4194304,
  array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from storage.buckets where id = 'identificaciones-pacientes'
    and public = false and file_size_limit = 4194304
    and allowed_mime_types @> array['image/jpeg','image/png','image/webp','application/pdf']::text[]
    and allowed_mime_types <@ array['image/jpeg','image/png','image/webp','application/pdf']::text[]) then
    raise exception 'El bucket de identificaciones tiene otra configuración. Revisar antes de aplicar.';
  end if;
end $$;

drop policy if exists "identificaciones_clinica_lee" on storage.objects;
create policy "identificaciones_clinica_lee" on storage.objects for select to authenticated
using (
  bucket_id = 'identificaciones-pacientes'
  and public.current_rol() in ('admin','doctora','asistente','gerente')
  and name ~ '^pacientes/[0-9a-f-]{36}/(frente|reverso|tutor|otra)-[0-9a-f-]{36}\.(jpg|png|webp|pdf)$'
  and exists (select 1 from public.pacientes p where p.id::text = split_part(name,'/',2))
);

drop policy if exists "identificaciones_clinica_agrega" on storage.objects;
create policy "identificaciones_clinica_agrega" on storage.objects for insert to authenticated
with check (
  bucket_id = 'identificaciones-pacientes'
  and public.current_rol() in ('admin','doctora','asistente','gerente')
  and name ~ '^pacientes/[0-9a-f-]{36}/(frente|reverso|tutor|otra)-[0-9a-f-]{36}\.(jpg|png|webp|pdf)$'
  and exists (select 1 from public.pacientes p where p.id::text = split_part(name,'/',2))
);

-- No hay permisos de reemplazo o borrado: una carga no elimina otra.
commit;
