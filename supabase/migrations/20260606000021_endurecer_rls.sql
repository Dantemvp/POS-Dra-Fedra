-- ============================================================================
-- Endurecimiento de RLS (auditoría)
--   1. servicios: escritura solo admin/doctora; lectura para clínica completa.
--   2. productos: farmacia gestiona (select/insert/update) pero NO borra;
--      el borrado queda solo para admin (policy admin_all_productos ya existe).
-- ============================================================================

-- 1. SERVICIOS ---------------------------------------------------------------
drop policy if exists "clinica_servicios" on servicios;

create policy "clinica_lee_servicios" on servicios
  for select using (current_rol() in ('doctora', 'asistente', 'admin'));

create policy "doctora_gestiona_servicios" on servicios
  for all using (current_rol() in ('doctora', 'admin'))
  with check (current_rol() in ('doctora', 'admin'));

-- 2. PRODUCTOS ---------------------------------------------------------------
-- Reemplaza la policy "for all" de farmacia por select/insert/update (sin delete).
drop policy if exists "farmacia_productos" on productos;

create policy "farmacia_lee_productos_rw" on productos
  for select using (current_rol() in ('farmacia', 'admin'));

create policy "farmacia_inserta_productos" on productos
  for insert with check (current_rol() in ('farmacia', 'admin'));

create policy "farmacia_actualiza_productos" on productos
  for update using (current_rol() in ('farmacia', 'admin'))
  with check (current_rol() in ('farmacia', 'admin'));
-- DELETE en productos queda cubierto únicamente por admin_all_productos (admin).
