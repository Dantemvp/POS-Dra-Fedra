-- Corte del día ampliado: además del total de ventas y el efectivo esperado
-- (ya existían), el corte ahora guarda un resumen completo del día y el conteo
-- físico para cuadrar la caja. Todas las columnas son ADITIVAS y nullable, así
-- que los cortes ya registrados no se ven afectados.
--
--   total_cobros        — ingresos del consultorio (tabla cobros) en el día
--   total_productos     — unidades de producto que salieron por ventas
--   pacientes_atendidos — número de cobros a pacientes en el día
--   efectivo_contado    — efectivo físico contado en el cajón al cierre
--   desglose            — montos por método (efectivo/tarjeta/…) en JSON
--
-- `total_efectivo` se usa como efectivo ESPERADO y `diferencia` = contado − esperado.
alter table cortes_caja add column if not exists total_cobros numeric(12,2);
alter table cortes_caja add column if not exists total_productos integer;
alter table cortes_caja add column if not exists pacientes_atendidos integer;
alter table cortes_caja add column if not exists efectivo_contado numeric(12,2);
alter table cortes_caja add column if not exists desglose jsonb;
