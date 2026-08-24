-- ============================================================================
-- FED-014 · Cerrar por ruta y rol el bucket `archivos`, y dejar rastro de los
-- documentos clínicos. Cierra H-016 y H-017.
--
-- Regla de negocio confirmada por Dante el 22 de agosto de 2026: los documentos
-- clínicos no se borran físicamente ni se sustituyen. Una corrección entra como
-- documento nuevo, conserva el anterior y queda vinculada a una bitácora.
--
-- REVERSA. El conjunto anterior de políticas queda citado íntegro aquí abajo,
-- de modo que restablecerlo sea otra migración hacia adelante y no una edición
-- de lo ya aplicado. Si un flujo legítimo se rompe, se restablece ese conjunto
-- y H-016 vuelve a Abierto en el mismo movimiento, porque volver a las
-- políticas planas reabre el agujero. La tabla `documentos_clinicos` es
-- aditiva y NO se retira en una reversa: quitarla perdería el rastro que la
-- regla de negocio exige conservar.
--
--   create policy "archivos_select" on storage.objects
--     for select to authenticated using (bucket_id = 'archivos');
--   create policy "archivos_insert" on storage.objects
--     for insert to authenticated with check (bucket_id = 'archivos');
--   create policy "archivos_update" on storage.objects
--     for update to authenticated using (bucket_id = 'archivos');
--   create policy "archivos_delete" on storage.objects
--     for delete to authenticated using (bucket_id = 'archivos');
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tabla de documentos clínicos (H-017)
--
-- Hasta hoy ninguna fila de la base apuntaba a un objeto bajo `inbody/`: la
-- ruta se usaba para firmar la URL y leer el archivo, y se descartaba. Sin esta
-- tabla no hay a qué colgar la bitácora que la regla de negocio exige, así que
-- es requisito previo y no un extra.
--
-- `paciente_id` va con `on delete restrict` a propósito. Las demás tablas del
-- esquema usan `on delete cascade`, y aquí eso significaría que borrar una
-- paciente se lleva el rastro de sus estudios. Un documento clínico sobrevive a
-- la fila que lo motivó.
-- ----------------------------------------------------------------------------
create table if not exists public.documentos_clinicos (
  id          uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete restrict,
  path        text not null unique,
  tipo        text not null default 'inbody',
  subido_por  uuid references public.usuarios(id),
  -- Una corrección apunta al documento que viene a corregir. El anterior se
  -- conserva: nada se sustituye en su lugar.
  sustituye_a uuid references public.documentos_clinicos(id),
  creado_en   timestamptz not null default now()
);

create index if not exists idx_documentos_clinicos_paciente
  on public.documentos_clinicos (paciente_id, creado_en desc);

comment on table public.documentos_clinicos is
  'Rastro de los documentos clínicos almacenados en el bucket archivos. Sólo se agrega: una corrección es una fila nueva que apunta a la anterior con sustituye_a. No se actualiza ni se borra.';

alter table public.documentos_clinicos enable row level security;

-- Lectura: los mismos roles que RUTAS_ROL concede a /pacientes.
drop policy if exists "documentos_clinicos_select" on public.documentos_clinicos;
create policy "documentos_clinicos_select" on public.documentos_clinicos
  for select to authenticated
  using (public.current_rol() in ('admin', 'doctora', 'asistente', 'gerente'));

-- Alta: quien puede subir un estudio. El gerente lee pero no captura.
drop policy if exists "documentos_clinicos_insert" on public.documentos_clinicos;
create policy "documentos_clinicos_insert" on public.documentos_clinicos
  for insert to authenticated
  with check (public.current_rol() in ('admin', 'doctora', 'asistente'));

-- No se declara política de update ni de delete. Sin política, RLS niega. Es la
-- forma de decir "nadie" que no depende de que alguien recuerde la excepción.

drop policy if exists "postgres_documentos_clinicos" on public.documentos_clinicos;
create policy "postgres_documentos_clinicos" on public.documentos_clinicos
  for all to postgres using (true) with check (true);

-- La tabla entra a la bitácora, como exige la verificación de H-017.
drop trigger if exists audit_documentos_clinicos on public.documentos_clinicos;
create trigger audit_documentos_clinicos
  after insert or update or delete on public.documentos_clinicos
  for each row execute function public.fn_audit();

-- ----------------------------------------------------------------------------
-- 2. Cómo se reconoce un objeto de producto
--
-- Los archivos de producto viven en `{productoId}/{marca-de-tiempo}-{nombre}`.
-- El ticket contemplaba resolverlos con un `exists` contra
-- `producto_archivos.path`, y eso NO funciona para el alta: la aplicación sube
-- el objeto primero y crea la fila después
-- (`src/app/(app)/inventario/[id]/Archivos.tsx`), así que una política de
-- insert que exigiera la fila bloquearía toda subida legítima. Además dejaría
-- inalcanzable cualquier objeto cuya fila no se llegó a crear, que es
-- exactamente el huérfano que este mismo ticket viene a evitar.
--
-- Se resuelve por el primer segmento de la ruta contra `productos`, que sirve
-- igual para las cuatro operaciones. Cuando el paso dos mueva los objetos a
-- `productos/{id}/...`, esta función es lo único que cambia.
--
-- `split_part` sobre `inbody/...` devuelve `inbody`, que simplemente no empata
-- con ningún id: la comparación es entre textos y no puede reventar por un cast.
-- ----------------------------------------------------------------------------
-- El parametro se llama `p_ruta` y no `ruta` ni `nombre` por una razon que ya
-- costo una corrida de integracion continua: `public.productos` tiene una
-- columna `nombre`, y dentro del `from` de esta consulta una referencia
-- desnuda a `nombre` la resuelve PostgreSQL contra la COLUMNA, no contra el
-- parametro. La comparacion quedaba "el uuid del producto contra su propio
-- nombre", siempre falsa, y ninguna ruta de producto era alcanzable. Es el
-- mismo gotcha de ambiguedad que `CLAUDE.md` ya documenta para las RPC con
-- RETURNING, y por eso el resto del repositorio usa el prefijo `p_`.
create or replace function public.es_objeto_de_producto(p_ruta text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.productos p
    where p.id::text = split_part(p_ruta, '/', 1)
  );
$$;

revoke execute on function public.es_objeto_de_producto(text) from public, anon;
grant execute on function public.es_objeto_de_producto(text) to authenticated;

-- ----------------------------------------------------------------------------
-- 3. Políticas del bucket `archivos`
--
-- Niega por omisión: lo que no cae en una de estas políticas no es alcanzable
-- por nadie con la llave anónima y una sesión, sin importar el rol.
-- ----------------------------------------------------------------------------
drop policy if exists "archivos_select" on storage.objects;
drop policy if exists "archivos_insert" on storage.objects;
drop policy if exists "archivos_update" on storage.objects;
drop policy if exists "archivos_delete" on storage.objects;

-- --- Documentos clínicos: `inbody/` -----------------------------------------
-- Lectura para los roles que ya alcanzan /pacientes. Farmacia no está, y ése
-- es el punto de H-016.
drop policy if exists "archivos_clinico_select" on storage.objects;
create policy "archivos_clinico_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'archivos'
    and split_part(name, '/', 1) = 'inbody'
    and public.current_rol() in ('admin', 'doctora', 'asistente', 'gerente')
  );

-- Alta de un estudio nuevo. Una corrección entra por aquí, con ruta nueva.
drop policy if exists "archivos_clinico_insert" on storage.objects;
create policy "archivos_clinico_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'archivos'
    and split_part(name, '/', 1) = 'inbody'
    and public.current_rol() in ('admin', 'doctora', 'asistente')
  );

-- No hay política de update ni de delete sobre `inbody/`. Nadie sustituye y
-- nadie borra un documento clínico, ni el administrador ni la doctora. Es la
-- regla que Dante confirmó y aquí se implementa por ausencia, que es la única
-- forma que no depende de recordar una excepción.

-- --- Archivos de producto ---------------------------------------------------
drop policy if exists "archivos_producto_select" on storage.objects;
create policy "archivos_producto_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'archivos'
    and split_part(name, '/', 1) <> 'inbody'
    and public.es_objeto_de_producto(name)
    and public.current_rol() in ('admin', 'farmacia', 'doctora', 'asistente', 'gerente')
  );

drop policy if exists "archivos_producto_insert" on storage.objects;
create policy "archivos_producto_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'archivos'
    and split_part(name, '/', 1) <> 'inbody'
    and public.es_objeto_de_producto(name)
    and public.current_rol() in ('admin', 'farmacia')
  );

drop policy if exists "archivos_producto_update" on storage.objects;
create policy "archivos_producto_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'archivos'
    and split_part(name, '/', 1) <> 'inbody'
    and public.es_objeto_de_producto(name)
    and public.current_rol() in ('admin', 'farmacia')
  )
  with check (
    bucket_id = 'archivos'
    and split_part(name, '/', 1) <> 'inbody'
    and public.es_objeto_de_producto(name)
    and public.current_rol() in ('admin', 'farmacia')
  );

drop policy if exists "archivos_producto_delete" on storage.objects;
create policy "archivos_producto_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'archivos'
    and split_part(name, '/', 1) <> 'inbody'
    and public.es_objeto_de_producto(name)
    and public.current_rol() in ('admin', 'farmacia')
  );

-- ----------------------------------------------------------------------------
-- 4. Reconciliar al gerente en los metadatos de producto
--
-- El gerente entró después a las rutas de inventario y nunca se agregó a
-- `farmacia_producto_archivos`. Con las políticas de arriba lee los bytes, así
-- que si no lee la fila los dos vuelven a contradecirse. Escribir sigue siendo
-- de farmacia y admin.
-- ----------------------------------------------------------------------------
drop policy if exists "farmacia_producto_archivos" on public.producto_archivos;
create policy "farmacia_producto_archivos" on public.producto_archivos
  for all
  using (public.current_rol() in ('farmacia', 'admin', 'doctora', 'asistente', 'gerente'))
  with check (public.current_rol() in ('farmacia', 'admin'));
