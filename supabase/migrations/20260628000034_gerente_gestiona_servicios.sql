-- El meet del 24-jun pidió que el personal pueda crear/modificar servicios
-- estéticos. Decisión de Dante: el rol `gerente` (mano derecha de la Dra.)
-- puede crear y modificar servicios; el borrado sigue reservado a doctora/admin
-- (mismo criterio que en productos). El asistente permanece en solo lectura.
--
-- Políticas ADITIVAS: la lectura de gerente ya existe (mig. 027) y las de
-- doctora/admin no se tocan. RLS combina políticas con OR, así que esto solo
-- amplía permisos del gerente sin afectar a los demás roles.

create policy "gerente_crea_servicios" on servicios
  for insert with check (current_rol()::text = 'gerente');

create policy "gerente_actualiza_servicios" on servicios
  for update using (current_rol()::text = 'gerente')
  with check (current_rol()::text = 'gerente');
