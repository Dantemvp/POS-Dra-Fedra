-- Versión alineada con el registro remoto de la importación autorizada.
begin;
-- Originales clínicos privados, separados del bucket compartido de productos.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('historicos-clinicos','historicos-clinicos',false,52428800,array['application/pdf'])
on conflict (id) do nothing;

create table if not exists public.archivos_paciente_historicos (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete restrict,
  tipo text not null check (tipo in ('receta','inbody')),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  storage_path text not null unique,
  nombre_archivo text not null,
  fecha_documento date,
  origen_datos text not null,
  importado_en timestamptz not null default now(),
  unique (paciente_id,tipo,sha256),
  check (storage_path = tipo || '/' || paciente_id::text || '/' || sha256 || '.pdf')
);
alter table public.archivos_paciente_historicos enable row level security;
revoke all on public.archivos_paciente_historicos from anon, authenticated;
grant select on public.archivos_paciente_historicos to authenticated;
grant all on public.archivos_paciente_historicos to service_role;

drop policy if exists historicos_lectura_clinica on public.archivos_paciente_historicos;
create policy historicos_lectura_clinica on public.archivos_paciente_historicos for select to authenticated
using (public.current_rol()::text in ('admin','doctora','asistente','gerente'));

drop policy if exists historicos_objetos_lectura on storage.objects;
create policy historicos_objetos_lectura on storage.objects for select to authenticated
using (bucket_id = 'historicos-clinicos' and exists (
  select 1 from public.archivos_paciente_historicos d where d.storage_path = storage.objects.name
));
-- Sin políticas de alta, sobrescritura ni borrado para sesiones de la app.
commit;
