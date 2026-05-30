-- ============================================================================
-- Sistema Integrado Dra. Fedra Aldama — Esquema inicial
-- Diseñado para reemplazar la app AppSheet v5 (monolítica) por un modelo
-- normalizado, seguro y por fases. Ver Plan-Desarrollo-Sistema-Fedra.md
--
-- Principios:
--  - 1 sola tabla `pacientes` (no Paciente/2/3)
--  - Detalle clínico flexible en `historias_clinicas.datos` (JSONB) + plantillas
--  - Inventario por lote (trazabilidad COFEPRIS + caducidad)
--  - movimientos_inv append-only => base del Libro de Control
--  - RLS por rol (archivo de políticas aparte)
-- ============================================================================

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- ENUMS
-- ----------------------------------------------------------------------------
create type rol_usuario       as enum ('admin','farmacia','doctora','asistente');
create type fraccion_cofepris as enum ('I','II','III','IV','V','VI','na');
create type tipo_movimiento   as enum ('entrada','salida','ajuste','merma');
create type estado_venta      as enum ('pagada','cotizacion','cancelada');
create type metodo_pago       as enum ('efectivo','tarjeta','transferencia','otro');
create type estado_cita       as enum ('agendada','confirmada','cancelada','cedida','atendida');
create type estado_receta     as enum ('borrador','emitida','cancelada');
create type estado_wpp        as enum ('pendiente','enviado','entregado','leido','fallido');
create type tipo_wpp          as enum ('recordatorio','confirmacion','receta','otro');

-- ----------------------------------------------------------------------------
-- NÚCLEO / SEGURIDAD
-- ----------------------------------------------------------------------------
create table usuarios (
  id          uuid primary key default gen_random_uuid(),
  auth_uid    uuid unique,                       -- enlace a auth.users de Supabase
  nombre      text not null,
  email       text unique not null,
  rol         rol_usuario not null default 'asistente',
  activo      boolean not null default true,
  creado_en   timestamptz not null default now()
);
comment on table usuarios is 'Personal del sistema; rol define permisos (RLS).';

create table audit_log (
  id          bigserial primary key,
  usuario_id  uuid references usuarios(id),
  accion      text not null,                     -- INSERT/UPDATE/DELETE/LOGIN/...
  tabla       text,
  registro_id text,
  datos       jsonb,
  fecha       timestamptz not null default now()
);
comment on table audit_log is 'Bitácora de auditoría (seguridad + trazabilidad COFEPRIS).';

-- ----------------------------------------------------------------------------
-- PACIENTES (compartido farmacia <-> consultorio)
-- ----------------------------------------------------------------------------
create table pacientes (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null,
  apellidos       text,
  fecha_nac       date,
  sexo            text,
  telefono_wpp    text,                          -- para recordatorios WhatsApp
  email           text,
  peso_inicial    numeric(6,2),
  cintura_inicial numeric(6,2),
  notas           text,
  creado_en       timestamptz not null default now(),
  creado_por      uuid references usuarios(id)
);
comment on table pacientes is 'Fuente única de verdad del paciente/cliente. Datos clínicos detallados van en historias_clinicas.';
create index on pacientes (nombre);
create index on pacientes (telefono_wpp);

-- ============================================================================
-- FASE 1 — FARMACIA: POS + INVENTARIO + COFEPRIS
-- ============================================================================
create table categorias (
  id     uuid primary key default gen_random_uuid(),
  nombre text not null unique
);

create table proveedores (
  id       uuid primary key default gen_random_uuid(),
  nombre   text not null,
  contacto text,
  rfc      text
);

create table productos (
  id               uuid primary key default gen_random_uuid(),
  nombre           text not null,
  categoria_id     uuid references categorias(id),
  descripcion      text,
  precio_venta     numeric(10,2) not null default 0,
  stock_minimo     numeric(10,2) not null default 0,  -- dispara alerta
  requiere_receta  boolean not null default false,
  es_controlado    boolean not null default false,
  fraccion_cofepris fraccion_cofepris not null default 'na',
  unidad           text default 'pieza',
  activo           boolean not null default true,
  creado_en        timestamptz not null default now()
);
comment on column productos.es_controlado is 'Si true, entra al Libro de Control COFEPRIS.';
create index on productos (nombre);
create index on productos (categoria_id);

create table lotes (
  id              uuid primary key default gen_random_uuid(),
  producto_id     uuid not null references productos(id),
  lote            text,
  caducidad       date,
  cantidad_actual numeric(10,2) not null default 0,
  costo           numeric(10,2),
  creado_en       timestamptz not null default now()
);
comment on table lotes is 'Inventario por lote: trazabilidad y control de caducidad.';
create index on lotes (producto_id);
create index on lotes (caducidad);

create table compras (
  id          uuid primary key default gen_random_uuid(),
  proveedor_id uuid references proveedores(id),
  factura     text,
  fecha       date not null default current_date,
  total       numeric(12,2),
  usuario_id  uuid references usuarios(id),
  creado_en   timestamptz not null default now()
);

create table compra_items (
  id          uuid primary key default gen_random_uuid(),
  compra_id   uuid not null references compras(id) on delete cascade,
  producto_id uuid not null references productos(id),
  lote_id     uuid references lotes(id),
  cantidad    numeric(10,2) not null,
  costo_unit  numeric(10,2)
);

create table movimientos_inv (
  id           bigserial primary key,
  producto_id  uuid not null references productos(id),
  lote_id      uuid references lotes(id),
  tipo         tipo_movimiento not null,
  cantidad     numeric(10,2) not null,
  motivo       text,
  referencia_id text,                            -- venta_id / compra_id / etc.
  usuario_id   uuid references usuarios(id),
  fecha        timestamptz not null default now()
);
comment on table movimientos_inv is 'Append-only. Toda entrada/salida de inventario. Base del Libro de Control.';
create index on movimientos_inv (producto_id, fecha);

create table ventas (
  id          uuid primary key default gen_random_uuid(),
  folio       bigserial,
  paciente_id uuid references pacientes(id),     -- opcional (venta de mostrador)
  usuario_id  uuid not null references usuarios(id),
  fecha       timestamptz not null default now(),
  subtotal    numeric(12,2) not null default 0,
  total       numeric(12,2) not null default 0,
  metodo_pago metodo_pago,
  estado      estado_venta not null default 'pagada'
);
create index on ventas (fecha);

create table venta_items (
  id          uuid primary key default gen_random_uuid(),
  venta_id    uuid not null references ventas(id) on delete cascade,
  producto_id uuid not null references productos(id),
  lote_id     uuid references lotes(id),
  cantidad    numeric(10,2) not null,
  precio_unit numeric(10,2) not null
);

create table pagos (
  id        uuid primary key default gen_random_uuid(),
  venta_id  uuid not null references ventas(id) on delete cascade,
  monto     numeric(12,2) not null,
  metodo    metodo_pago not null default 'efectivo',
  fecha     timestamptz not null default now()
);
comment on table pagos is 'Permite abonos / pagos parciales sobre una venta.';

create table cortes_caja (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null references usuarios(id),
  apertura       timestamptz not null default now(),
  cierre         timestamptz,
  fondo          numeric(12,2) default 0,
  total_efectivo numeric(12,2),
  total_ventas   numeric(12,2),
  diferencia     numeric(12,2)
);

-- Vista: Libro de Control COFEPRIS (solo productos controlados)
create view libro_control as
select
  m.producto_id,
  p.nombre as producto,
  p.fraccion_cofepris,
  m.lote_id,
  date_trunc('day', m.fecha) as dia,
  sum(case when m.tipo = 'entrada' then m.cantidad else 0 end) as entradas,
  sum(case when m.tipo in ('salida','merma') then m.cantidad else 0 end) as salidas
from movimientos_inv m
join productos p on p.id = m.producto_id
where p.es_controlado = true
group by m.producto_id, p.nombre, p.fraccion_cofepris, m.lote_id, date_trunc('day', m.fecha);
comment on view libro_control is 'Resumen para Libro de Control COFEPRIS. El balance (existencia) se calcula acumulando entradas-salidas. VALIDAR con Raúl/normativa vigente.';

-- ============================================================================
-- FASE 2 — CONSULTORIO: HISTORIA CLÍNICA + RECETAS + AGENDA
-- ============================================================================
create table tipos_historia (
  id     uuid primary key default gen_random_uuid(),
  nombre text not null,                          -- control_peso, toxina, faciales, general
  activo boolean not null default true
);

create table campos_historia (
  id               uuid primary key default gen_random_uuid(),
  tipo_historia_id uuid not null references tipos_historia(id) on delete cascade,
  etiqueta         text not null,                -- "¿Toma algún medicamento?"
  tipo_dato        text not null default 'texto',-- texto|numero|fecha|booleano|opciones
  opciones         jsonb,                        -- para tipo_dato='opciones'
  orden            int not null default 0,
  requerido        boolean not null default false
);
comment on table campos_historia is 'Define las preguntas de cada plantilla. EDITABLE por la doctora sin programador (resuelve dolor #1 de HC).';

create table historias_clinicas (
  id               uuid primary key default gen_random_uuid(),
  paciente_id      uuid not null references pacientes(id),
  tipo_historia_id uuid not null references tipos_historia(id),
  fecha            timestamptz not null default now(),
  datos            jsonb not null default '{}',  -- respuestas flexibles segun plantilla
  doctora_id       uuid references usuarios(id)
);
create index on historias_clinicas (paciente_id);

create table consultas (
  id                 uuid primary key default gen_random_uuid(),
  paciente_id        uuid not null references pacientes(id),
  doctora_id         uuid references usuarios(id),
  fecha              timestamptz not null default now(),
  motivo             text,
  costo              numeric(10,2),
  incluye_medicamento boolean not null default false
);

create table tratamientos (
  id          uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes(id),
  tipo        text,                              -- combinado, etc.
  inicio      date default current_date,
  estado      text default 'activo'
);

create table fases (
  id              uuid primary key default gen_random_uuid(),
  tratamiento_id  uuid not null references tratamientos(id) on delete cascade,
  numero          int not null,                  -- 1..5
  peso_actual     numeric(6,2),
  cintura_actual  numeric(6,2),
  peso_perdido    numeric(6,2),
  meta_siguiente  text,
  fecha           date default current_date
);

create table recetas (
  id          uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes(id),
  consulta_id uuid references consultas(id),
  fase        int,
  folio       bigserial,
  fecha       timestamptz not null default now(),
  pdf_url     text,                              -- Storage de Supabase
  estado      estado_receta not null default 'borrador'
);

create table receta_items (
  id            uuid primary key default gen_random_uuid(),
  receta_id     uuid not null references recetas(id) on delete cascade,
  producto_id   uuid references productos(id),
  medicamento   text,                            -- libre si no está en catálogo
  dosis         text,
  duracion_dias int,
  indicaciones  text
);

create table citas (
  id                  uuid primary key default gen_random_uuid(),
  paciente_id         uuid not null references pacientes(id),
  doctora_id          uuid references usuarios(id),
  fecha_hora          timestamptz not null,
  estado              estado_cita not null default 'agendada',
  recordatorio_enviado boolean not null default false,
  confirmada_en       timestamptz,
  limite_confirmacion timestamptz,               -- ej: 1pm del día previo
  notas               text
);
create index on citas (fecha_hora);

create table seguimientos (
  id          uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes(id),
  fecha       timestamptz not null default now(),
  nota        text,
  alerta_en   timestamptz
);

-- ============================================================================
-- CONEXIONES
-- ============================================================================
create table mensajes_wpp (
  id          uuid primary key default gen_random_uuid(),
  paciente_id uuid references pacientes(id),
  cita_id     uuid references citas(id),
  tipo        tipo_wpp not null,
  template    text,
  estado      estado_wpp not null default 'pendiente',
  enviado_en  timestamptz,
  creado_en   timestamptz not null default now()
);
comment on table mensajes_wpp is 'Registro de mensajes WhatsApp (recordatorios/confirmaciones/recetas).';
