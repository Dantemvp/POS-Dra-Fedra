-- La doctora (dueña) debe poder auditar los cortes y el detalle de ventas de
-- farmacia, no solo la clínica. Hoy farmacia/admin/gerente ya acceden a estas
-- tablas; aquí se agrega LECTURA para la doctora (cobros ya los lee por el
-- modelo clínico). Políticas aditivas de solo SELECT — no puede modificar nada.

create policy "doctora_lee_cortes" on cortes_caja
  for select using (current_rol()::text = 'doctora');

create policy "doctora_lee_ventas" on ventas
  for select using (current_rol()::text = 'doctora');

create policy "doctora_lee_venta_items" on venta_items
  for select using (current_rol()::text = 'doctora');

create policy "doctora_lee_pagos" on pagos
  for select using (current_rol()::text = 'doctora');
