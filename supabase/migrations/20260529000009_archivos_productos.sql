-- ============================================================================
-- Adjuntos de productos: fotos, documentos, audios.
-- Bucket de Storage + tabla de metadatos producto_archivos.
-- ============================================================================

-- Bucket de almacenamiento (privado; se accede con sesión)
insert into storage.buckets (id, name, public)
values ('archivos', 'archivos', false)
on conflict (id) do nothing;

-- Tabla de metadatos
create table if not exists producto_archivos (
  id          uuid primary key default gen_random_uuid(),
  producto_id uuid not null references productos(id) on delete cascade,
  nombre      text,
  tipo        text,                -- imagen | documento | audio | otro
  path        text not null,       -- ruta dentro del bucket
  subido_por  uuid references usuarios(id),
  creado_en   timestamptz not null default now()
);
create index if not exists idx_producto_archivos_prod on producto_archivos (producto_id);

alter table producto_archivos enable row level security;

drop policy if exists "admin_all_producto_archivos" on producto_archivos;
create policy "admin_all_producto_archivos" on producto_archivos
  for all using (es_admin()) with check (es_admin());

drop policy if exists "farmacia_producto_archivos" on producto_archivos;
create policy "farmacia_producto_archivos" on producto_archivos
  for all using (current_rol() in ('farmacia','admin','doctora','asistente'))
  with check (current_rol() in ('farmacia','admin'));

drop policy if exists "postgres_producto_archivos" on producto_archivos;
create policy "postgres_producto_archivos" on producto_archivos
  for all to postgres using (true) with check (true);
