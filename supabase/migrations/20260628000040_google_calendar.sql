-- Vinculación de la agenda con Google Calendar (sincronización POS -> Calendar).
-- Todo es ADITIVO: no toca datos ni el flujo existente de citas.

-- 1) Cada cita recuerda el id del evento que creó en Google, para poder
--    actualizarlo o borrarlo después. Nullable: las citas viejas y las que se
--    creen sin conexión activa simplemente no tienen evento.
alter table citas add column if not exists google_event_id text;

-- 2) Conexión única con Google (un solo calendario para todo el consultorio).
--    El patrón de "una sola fila" se logra con PK booleana fija en true.
--    Los tokens son secretos: la tabla NO expone ninguna política a los roles
--    normales; solo se accede desde el servidor con service_role (admin client).
create table if not exists google_calendar_conexion (
  id boolean primary key default true,
  constraint google_calendar_una_fila check (id),
  access_token text,
  refresh_token text not null,
  expiry timestamptz,
  calendar_id text not null default 'primary',
  email text,
  conectado_por uuid references usuarios(id),
  conectado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

alter table google_calendar_conexion enable row level security;
-- Sin políticas a propósito: nadie con anon/authenticated puede leer los tokens.
-- El estado de conexión se consulta desde el servidor (server action) que usa
-- el service_role y devuelve solo {conectado, email}, nunca los tokens.
