-- Dirección del paciente: requerida por COFEPRIS para la venta de medicamento
-- controlado. Se agrega como columna NULLABLE para no romper los pacientes ya
-- existentes (la migración legacy cargó ~509 sin este dato); la obligatoriedad
-- se aplica en el formulario de alta. Los registros viejos se completan al editar.
alter table pacientes
  add column if not exists direccion text;
comment on column pacientes.direccion is
  'Domicilio del paciente. Obligatorio en altas nuevas (COFEPRIS, venta de controlados).';
