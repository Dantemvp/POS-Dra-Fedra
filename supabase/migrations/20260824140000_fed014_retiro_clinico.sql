-- ============================================================================
-- FED-014 · Retiro administrativo de un documento clínico mal asignado.
--
-- El problema que resuelve. La regla dice que nadie borra ni sustituye un
-- documento clínico, y las políticas de `20260824120000` la implementan por
-- ausencia de política de update y de delete sobre `inbody/`. Esa regla protege
-- la evidencia, pero deja un caso sin atender: si alguien sube el estudio de la
-- paciente A al expediente de la paciente B, ese archivo queda legible para los
-- cuatro roles clínicos para siempre. Eso ya no es conservar evidencia, es una
-- fuga de datos de una paciente hacia el expediente de otra.
--
-- Cómo se resuelve. No relajando la regla, sino con una salida excepcional que
-- no pasa por la aplicación: el objeto se mueve al prefijo `cuarentena/`, que
-- no aparece en ninguna política del bucket y por lo tanto no es alcanzable
-- para ningún rol, ni siquiera para admin. Sigue existiendo, y sigue estando a
-- la mano de la llave de servicio si un juez, la doctora o una auditoría lo
-- piden. La fila de `documentos_clinicos` NO se borra: queda apuntando a una
-- ruta que ya no responde, y esta bitácora explica por qué.
--
-- Quién lo ejecuta. Sólo la llave de servicio, desde
-- `scripts/retiro-clinico.mjs`, fuera de la aplicación y con las manos de una
-- persona. No hay RPC ni server action que lo dispare: una función expuesta al
-- cliente sería justo el borrado que la regla prohíbe, con otro nombre.
--
-- REVERSA. Retirar esta migración deja sin registrar los retiros ya hechos, así
-- que no se retira. Si el procedimiento se descarta, se descarta el script y la
-- tabla se queda con lo que documentó.
-- ============================================================================

create table if not exists public.retiros_clinicos (
  id              uuid primary key default gen_random_uuid(),
  -- Puede ser nulo: un objeto huérfano, anterior a `documentos_clinicos`,
  -- también se puede retirar y su retiro también tiene que constar.
  documento_id    uuid references public.documentos_clinicos(id) on delete restrict,
  path_original   text not null,
  path_cuarentena text not null unique,
  -- Por qué se retiró, con palabras de quien lo autorizó. Un motivo de tres
  -- letras no es un motivo, y dentro de un año nadie va a recordar el caso.
  motivo          text not null,
  -- Quién autoriza. Va como texto y no como llave foránea a propósito: quien
  -- autoriza el retiro de un estudio suele ser la doctora o la propia paciente,
  -- y la paciente no es un usuario del sistema.
  responsable     text not null,
  -- Quién ejecutó el movimiento, si fue alguien con cuenta.
  ejecutado_por   uuid references public.usuarios(id),
  solicitado_en   timestamptz not null default now(),
  -- Se sella cuando el objeto ya está en cuarentena. Nulo significa retiro a
  -- medias, y es lo que hay que buscar si algo se interrumpió.
  movido_en       timestamptz,

  constraint retiros_clinicos_motivo_suficiente
    check (length(btrim(motivo)) >= 20),
  constraint retiros_clinicos_responsable_suficiente
    check (length(btrim(responsable)) >= 3),
  constraint retiros_clinicos_destino_en_cuarentena
    check (split_part(path_cuarentena, '/', 1) = 'cuarentena'
           and split_part(path_cuarentena, '/', 2) <> ''),
  constraint retiros_clinicos_origen_clinico
    check (split_part(path_original, '/', 1) = 'inbody')
);

create index if not exists idx_retiros_clinicos_documento
  on public.retiros_clinicos (documento_id);

comment on table public.retiros_clinicos is
  'Bitácora inmutable de los retiros administrativos de documentos clínicos. Sólo la llave de servicio escribe aquí, y sólo una vez por retiro.';

alter table public.retiros_clinicos enable row level security;

-- Lectura para quienes ya ven /movimientos. Farmacia y asistente no la ven, por
-- la misma razón por la que no ven el expediente: el motivo de un retiro habla
-- de una paciente.
drop policy if exists "retiros_clinicos_select" on public.retiros_clinicos;
create policy "retiros_clinicos_select" on public.retiros_clinicos
  for select to authenticated
  using (public.current_rol() in ('admin', 'doctora'));

-- No hay política de insert, update ni delete para `authenticated`. Escribir un
-- retiro exige la llave de servicio, que es la puerta que se abre a mano.

drop policy if exists "postgres_retiros_clinicos" on public.retiros_clinicos;
create policy "postgres_retiros_clinicos" on public.retiros_clinicos
  for all to postgres using (true) with check (true);

-- ----------------------------------------------------------------------------
-- Inmutabilidad de verdad, no sólo por RLS
--
-- RLS no alcanza a la llave de servicio: `service_role` la ignora, y es
-- precisamente el rol que escribe aquí. Sin este disparador, el mismo script
-- que registra un retiro podría reescribir el motivo o borrar la fila después.
-- Un disparador sí lo alcanza.
--
-- Lo único que se permite cambiar es `movido_en`, y sólo de nulo a un valor:
-- es el sello de que el objeto ya llegó a cuarentena, y el retiro se registra
-- ANTES de mover para que un movimiento interrumpido deje rastro en vez de
-- desaparición. Después de sellado, la fila no vuelve a cambiar nunca.
-- ----------------------------------------------------------------------------
create or replace function public.fn_retiros_clinicos_inmutable()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Un retiro clínico no se borra: es la evidencia de que el documento no desapareció solo.';
  end if;

  if new.id is distinct from old.id
     or new.documento_id is distinct from old.documento_id
     or new.path_original is distinct from old.path_original
     or new.path_cuarentena is distinct from old.path_cuarentena
     or new.motivo is distinct from old.motivo
     or new.responsable is distinct from old.responsable
     or new.ejecutado_por is distinct from old.ejecutado_por
     or new.solicitado_en is distinct from old.solicitado_en then
    raise exception 'Un retiro clínico no se corrige: se registra otro. Sólo movido_en admite cambio.';
  end if;

  if old.movido_en is not null and new.movido_en is distinct from old.movido_en then
    raise exception 'El sello de movido_en ya está puesto y no se vuelve a tocar.';
  end if;

  return new;
end $$;

revoke execute on function public.fn_retiros_clinicos_inmutable() from public, anon, authenticated;

drop trigger if exists retiros_clinicos_inmutable on public.retiros_clinicos;
create trigger retiros_clinicos_inmutable
  before update or delete on public.retiros_clinicos
  for each row execute function public.fn_retiros_clinicos_inmutable();

-- Y además entra a la bitácora general, como el resto de lo sensible.
drop trigger if exists audit_retiros_clinicos on public.retiros_clinicos;
create trigger audit_retiros_clinicos
  after insert or update or delete on public.retiros_clinicos
  for each row execute function public.fn_audit();
