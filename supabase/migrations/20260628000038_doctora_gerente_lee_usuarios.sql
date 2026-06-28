-- Trazabilidad: para saber QUIÉN hizo cada corte (y, en general, cada
-- movimiento del POS), la doctora y el gerente necesitan leer los nombres de
-- los usuarios. Hoy solo el admin lee toda la tabla (los demás ven su propia
-- fila). Política aditiva de solo SELECT — no pueden crear ni modificar usuarios.
create policy "doctora_gerente_lee_usuarios" on usuarios
  for select using (current_rol()::text in ('doctora', 'gerente'));
