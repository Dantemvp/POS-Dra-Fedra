-- Agenda libre: los eventos ya no tienen que ser citas de paciente.
--   - paciente_id pasa a ser opcional (NULL para eventos sin paciente)
--   - tipo: cita_paciente | reunion | trabajo | interesado | otro
--   - titulo: nombre del evento cuando NO es cita de paciente (ej. "Reunión proveedor")
alter table citas alter column paciente_id drop not null;
alter table citas add column if not exists tipo text not null default 'cita_paciente';
alter table citas add column if not exists titulo text;
comment on column citas.tipo is
  'cita_paciente | reunion | trabajo | interesado | otro';
comment on column citas.titulo is
  'Nombre del evento cuando no es cita de paciente.';
