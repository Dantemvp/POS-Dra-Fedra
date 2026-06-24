-- ¿El paciente ya nos dejó reseña en Google Maps? (marketing / seguimiento)
alter table pacientes
  add column if not exists review_google boolean not null default false;
comment on column pacientes.review_google is
  'Si el paciente ya dejó reseña en Google Maps.';
