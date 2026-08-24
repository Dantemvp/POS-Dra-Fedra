-- ============================================================================
-- FED-014 · Cerrar por ruta y rol el bucket `archivos`, y dejar rastro de los
-- documentos clínicos. Cierra H-016 y H-017.
--
-- Regla de negocio confirmada por Dante el 22 de agosto de 2026: los documentos
-- clínicos no se borran físicamente ni se sustituyen. Una corrección entra como
-- documento nuevo, conserva el anterior y queda vinculada a una bitácora. El
-- retiro excepcional de un documento mal asignado no vive aquí: es un
-- procedimiento aparte con la llave de servicio, en
-- `20260824140000_fed014_retiro_clinico.sql`.
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
-- 0. Auxiliares de autorización e integridad
--
-- Resuelven objetos por nombre calificado y no aceptan un `search_path`
-- controlable por quien llama, igual que `current_rol()` desde
-- `20260824020537_harden_privileged_objects.sql`.
--
-- Los parámetros llevan el prefijo `p_` a propósito. Sin él, una referencia
-- desnuda dentro del `from` la resuelve PostgreSQL contra la COLUMNA de la
-- tabla consultada y no contra el parámetro: es el gotcha que `CLAUDE.md` ya
-- documenta para las RPC con RETURNING, y que aquí costó una corrida roja de
-- integración continua.
-- ----------------------------------------------------------------------------

-- Quién es, en la tabla `usuarios`, la sesión que está escribiendo.
--
-- `auth.uid()` devuelve el identificador de `auth.users`, y las llaves foráneas
-- de este esquema apuntan a `usuarios.id`, que es otra columna. Esta función es
-- la traducción entre ambas, y es la que permite exigir en una política que
-- `subido_por` sea quien de verdad está escribiendo, y no un uuid que el
-- cliente escribió a mano.
--
-- `security definer` porque `usuarios` tiene RLS y el dueño de esa tabla es el
-- mismo rol que corre esta migración, así que la resuelve sin depender de que
-- la sesión pueda leerse a sí misma.
create or replace function public.usuario_actual_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id
  from public.usuarios u
  where u.auth_uid = (select auth.uid())
  limit 1;
$$;

revoke execute on function public.usuario_actual_id() from public, anon;
grant execute on function public.usuario_actual_id() to authenticated, service_role;

comment on function public.usuario_actual_id() is
  'usuarios.id de la sesión actual. Traduce auth.uid() al identificador que usan las llaves foráneas del esquema.';

-- ¿El primer segmento de una ruta clínica corresponde a una paciente real?
--
-- Impide dar de alta un objeto bajo `inbody/{uuid-inventado}/...`, que nacería
-- huérfano y sin nadie a quien colgarlo. La comparación es entre textos: una
-- ruta cualquiera no puede reventar la política por un cast fallido.
create or replace function public.es_paciente_existente(p_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.pacientes p
    where p.id::text = p_id
  );
$$;

revoke execute on function public.es_paciente_existente(text) from public, anon;
grant execute on function public.es_paciente_existente(text) to authenticated, service_role;

-- ¿Existe de verdad el objeto en el bucket?
--
-- `security invoker`, y esto no es un olvido. Un `security definer` aquí lo
-- ejecutaría el dueño de la función, que NO es el dueño de `storage.objects`:
-- las políticas de ese esquema están declaradas `to authenticated`, no
-- aplicarían al rol de la función, y la comprobación negaría siempre. Como
-- invocador, el rol sigue siendo `authenticated` y la sesión ve el objeto que
-- acaba de subir. La llave de servicio ignora RLS y también lo ve, que es lo
-- que permite adoptar objetos anteriores a esta migración.
--
-- La consecuencia a tener presente: un rol que pudiera registrar el documento
-- pero no leer el objeto recibiría un falso negativo. Hoy los tres roles que
-- dan de alta leen todo lo que cuelga de `inbody/`, así que no ocurre.
create or replace function public.existe_objeto_archivos(p_ruta text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from storage.objects o
    where o.bucket_id = 'archivos'
      and o.name = p_ruta
  );
$$;

revoke execute on function public.existe_objeto_archivos(text) from public, anon;
grant execute on function public.existe_objeto_archivos(text) to authenticated, service_role;

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
--
-- INTEGRIDAD. Una política que sólo mire el rol deja pasar a un cliente
-- adversario: la aplicación manda valores honestos, pero cualquiera con la
-- llave anónima y una sesión válida escribe contra PostgREST el cuerpo que
-- quiera. Las tres reglas que no dependen de quién escribe viven aquí como
-- restricciones, para que valgan también para la llave de servicio:
--
--   a) la ruta pertenece a la paciente de la fila y tiene exactamente la forma
--      `inbody/{paciente_id}/{archivo}`. Eso solo ya rechaza una ruta de
--      producto, una ruta de otra paciente y una ruta anidada más hondo;
--   b) una corrección apunta a un documento de la MISMA paciente. Se consigue
--      con una llave foránea compuesta contra `(id, paciente_id)`, que la base
--      sostiene sin ayuda de nadie. `sustituye_a` nulo la satisface, porque una
--      llave foránea compuesta con una columna nula no se comprueba;
--   c) la ruta es única, y esa unicidad es la que vuelve idempotente el alta:
--      reintentar el registro de un objeto ya registrado choca contra ella en
--      lugar de duplicar el rastro.
--
-- Lo que sí depende de quién escribe (el rol, la identidad de `subido_por` y la
-- existencia del objeto) vive en la política de alta, más abajo.
-- ----------------------------------------------------------------------------
create table if not exists public.documentos_clinicos (
  id          uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete restrict,
  path        text not null unique,
  tipo        text not null default 'inbody',
  -- El valor por omisión es la identidad real de quien escribe. La aplicación
  -- ya no manda esta columna, y la política rechaza cualquier valor que no
  -- coincida con la sesión.
  subido_por  uuid references public.usuarios(id) default public.usuario_actual_id(),
  -- Una corrección apunta al documento que viene a corregir. El anterior se
  -- conserva: nada se sustituye en su lugar.
  sustituye_a uuid,
  creado_en   timestamptz not null default now(),

  -- Objetivo de la llave foránea compuesta de abajo. Es redundante frente a la
  -- llave primaria y existe sólo para que `(sustituye_a, paciente_id)` tenga
  -- contra qué apuntar.
  constraint documentos_clinicos_id_paciente unique (id, paciente_id),

  constraint documentos_clinicos_sustituye_misma_paciente
    foreign key (sustituye_a, paciente_id)
    references public.documentos_clinicos (id, paciente_id)
    on delete restrict,

  constraint documentos_clinicos_ruta_de_su_paciente check (
    split_part(path, '/', 1) = 'inbody'
    and split_part(path, '/', 2) = paciente_id::text
    and split_part(path, '/', 3) <> ''
    and split_part(path, '/', 4) = ''
  )
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
--
-- Las dos condiciones que se suman al rol:
--
--   `subido_por = usuario_actual_id()` cierra la falsificación de autoría. El
--   valor por omisión ya escribe la identidad correcta cuando el cliente omite
--   la columna; esta condición es la que rechaza al cliente que la manda con el
--   uuid de otra persona, y también al que la manda nula a propósito, porque
--   una comparación contra nulo no es verdadera.
--
--   `existe_objeto_archivos(path)` rechaza registrar una ruta que no está en el
--   bucket. Sin ella el rastro podría apuntar a la nada.
--
-- Y lo que NO se comprueba aquí, porque ya lo sostienen las restricciones de la
-- tabla: la forma de la ruta, su pertenencia a la paciente, y que la corrección
-- sea de la misma paciente.
drop policy if exists "documentos_clinicos_insert" on public.documentos_clinicos;
create policy "documentos_clinicos_insert" on public.documentos_clinicos
  for insert to authenticated
  with check (
    public.current_rol() in ('admin', 'doctora', 'asistente')
    and subido_por = public.usuario_actual_id()
    and public.existe_objeto_archivos(path)
  );

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
grant execute on function public.es_objeto_de_producto(text) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. Políticas del bucket `archivos`
--
-- Niega por omisión: lo que no cae en una de estas políticas no es alcanzable
-- por nadie con la llave anónima y una sesión, sin importar el rol. El prefijo
-- `cuarentena/` no aparece en ninguna, y por eso es inalcanzable.
-- ----------------------------------------------------------------------------
drop policy if exists "archivos_select" on storage.objects;
drop policy if exists "archivos_insert" on storage.objects;
drop policy if exists "archivos_update" on storage.objects;
drop policy if exists "archivos_delete" on storage.objects;

-- --- Documentos clínicos: `inbody/` -----------------------------------------
-- Lectura para los roles que ya alcanzan /pacientes. Farmacia no está, y ése
-- es el punto de H-016.
--
-- La lectura NO exige que la paciente siga existiendo. Un estudio anterior a
-- esta migración, o de una paciente dada de baja, tiene que seguir siendo
-- legible por los roles clínicos: es un documento, no un permiso.
drop policy if exists "archivos_clinico_select" on storage.objects;
create policy "archivos_clinico_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'archivos'
    and split_part(name, '/', 1) = 'inbody'
    and public.current_rol() in ('admin', 'doctora', 'asistente', 'gerente')
  );

-- Alta de un estudio nuevo. Una corrección entra por aquí, con ruta nueva.
--
-- El alta sí exige la forma exacta `inbody/{paciente}/{archivo}` y que la
-- paciente exista. Es lo que impide fabricar un objeto que después nadie va a
-- poder registrar, porque la restricción de la tabla lo rechazaría: sin esta
-- condición se podría subir a `inbody/loquesea/x.png` y dejarlo ahí para
-- siempre, ya que tampoco hay política de borrado que lo retire.
drop policy if exists "archivos_clinico_insert" on storage.objects;
create policy "archivos_clinico_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'archivos'
    and split_part(name, '/', 1) = 'inbody'
    and public.es_paciente_existente(split_part(name, '/', 2))
    and split_part(name, '/', 3) <> ''
    and split_part(name, '/', 4) = ''
    and public.current_rol() in ('admin', 'doctora', 'asistente')
  );

-- No hay política de update ni de delete sobre `inbody/`. Nadie sustituye y
-- nadie borra un documento clínico, ni el administrador ni la doctora. Es la
-- regla que Dante confirmó y aquí se implementa por ausencia, que es la única
-- forma que no depende de recordar una excepción. El documento mal asignado se
-- atiende con el retiro administrativo, no relajando esto.

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
-- 4. Metadatos de producto: separar leer de escribir
--
-- La política anterior era una sola `for all`, con un `using` que incluía a los
-- roles lectores y un `with check` limitado a farmacia y admin. En PostgreSQL
-- eso NO restringe el borrado: DELETE evalúa `using` y nunca `with check`, así
-- que cualquiera de los roles lectores podía borrar la fila de metadatos de un
-- archivo de producto. La misma trampa aplica al `using` de UPDATE, que decide
-- qué filas son actualizables.
--
-- Queda partida en cuatro. El gerente entra a la lectura porque alcanza las
-- rutas de inventario y con las políticas de Storage ya lee los bytes: si no
-- leyera la fila, las dos capas volverían a contradecirse. Escribir, corregir y
-- borrar siguen siendo de farmacia y admin.
-- ----------------------------------------------------------------------------
drop policy if exists "farmacia_producto_archivos" on public.producto_archivos;

drop policy if exists "producto_archivos_select" on public.producto_archivos;
create policy "producto_archivos_select" on public.producto_archivos
  for select to authenticated
  using (public.current_rol() in ('farmacia', 'admin', 'doctora', 'asistente', 'gerente'));

drop policy if exists "producto_archivos_insert" on public.producto_archivos;
create policy "producto_archivos_insert" on public.producto_archivos
  for insert to authenticated
  with check (public.current_rol() in ('farmacia', 'admin'));

drop policy if exists "producto_archivos_update" on public.producto_archivos;
create policy "producto_archivos_update" on public.producto_archivos
  for update to authenticated
  using (public.current_rol() in ('farmacia', 'admin'))
  with check (public.current_rol() in ('farmacia', 'admin'));

drop policy if exists "producto_archivos_delete" on public.producto_archivos;
create policy "producto_archivos_delete" on public.producto_archivos
  for delete to authenticated
  using (public.current_rol() in ('farmacia', 'admin'));

-- ----------------------------------------------------------------------------
-- 5. Inventario de huérfanos
--
-- Un objeto bajo `inbody/` sin fila en `documentos_clinicos` no se puede
-- borrar y no aparece en ninguna pantalla. Puede venir de antes de esta
-- migración, o de una subida cuyo registro falló a medio camino.
--
-- Esta vista los pone delante de los roles clínicos, que es la diferencia entre
-- un huérfano conocido y uno silencioso. `security_invoker` para que quien la
-- consulta vea exactamente lo que sus políticas le permiten ver: farmacia no
-- lee objetos clínicos, así que para farmacia la vista está vacía.
-- ----------------------------------------------------------------------------
create or replace view public.inbody_huerfanos
with (security_invoker = true) as
  select
    o.name                     as path,
    split_part(o.name, '/', 2) as paciente_id,
    o.created_at
  from storage.objects o
  where o.bucket_id = 'archivos'
    and split_part(o.name, '/', 1) = 'inbody'
    and not exists (
      select 1
      from public.documentos_clinicos d
      where d.path = o.name
    );

revoke all on table public.inbody_huerfanos from public, anon;
grant select on table public.inbody_huerfanos to authenticated;

comment on view public.inbody_huerfanos is
  'Objetos bajo inbody/ sin fila en documentos_clinicos. Se lee con los permisos de quien consulta: farmacia la ve vacía.';
