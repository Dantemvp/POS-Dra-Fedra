-- ============================================================================
-- Clasificación de procedencia de los datos operativos
--
-- Reemplazamos los datos operativos por los del AppSheet viejo ("Dra. Fedra v.5").
-- Esos registros se muestran tal cual llegaron, sin juzgar si siguen vigentes,
-- pero el sistema debe poder distinguirlos de lo que se capture desde hoy.
--
--   origen_datos  null  = capturado en este POS
--                 texto = lote de importación del que vino (ej. appsheet_v5_2026-09-10)
--   es_historico  true  = mostrar con la etiqueta "Información histórica importada"
--
-- Idempotente: se puede re-correr sin romper.
-- Reversa al final del archivo, comentada.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Columnas de procedencia en las tablas operativas
-- ----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'pacientes','historias_clinicas','recetas','receta_items','citas',
    'productos','lotes','ventas','venta_items','pagos',
    'proveedores','categorias','servicios',
    'cobros','cobro_items','cobro_pagos'
  ]
  loop
    execute format(
      'alter table public.%I add column if not exists origen_datos text;', t);
    execute format(
      'alter table public.%I add column if not exists es_historico boolean not null default false;', t);
  end loop;
end $$;

comment on column pacientes.origen_datos is
  'Lote de importación del que vino el registro. Null = capturado en este POS.';
comment on column pacientes.es_historico is
  'true = se muestra con la etiqueta "Información histórica importada".';

-- Índices solo donde hay filtro de pantalla (pacientes, recetas, inventario, ventas).
create index if not exists ix_pacientes_historico on pacientes(es_historico);
create index if not exists ix_recetas_historico   on recetas(es_historico);
create index if not exists ix_productos_historico on productos(es_historico);
create index if not exists ix_ventas_historico    on ventas(es_historico);

-- ----------------------------------------------------------------------------
-- 1a. Trazabilidad que faltaba
--
-- La migración 19 puso id_legacy en las tablas clínicas y la 20 en inventario,
-- pero el catálogo y las ventas quedaron fuera. Sin él no hay forma de re-correr
-- la importación sin duplicar, ni de rastrear un renglón hasta el AppSheet viejo.
-- ----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'categorias','proveedores','ventas','venta_items','pagos','cortes_caja',
    'consultas','tratamientos'
  ]
  loop
    execute format('alter table public.%I add column if not exists id_legacy text;', t);
    execute format(
      'create unique index if not exists ux_%1$s_legacy on public.%1$I(id_legacy) '
      'where id_legacy is not null;', t);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 1b. Cantidad recetada
--
-- El AppSheet viejo guardaba cuántas piezas se recetaban de cada medicamento y
-- este esquema no tenía dónde ponerlo. Es dato clínico: se conserva. La receta
-- impresa NO cambia — ese código es delicado y no se toca en esta operación.
-- ----------------------------------------------------------------------------
alter table receta_items add column if not exists cantidad numeric(10,2);
comment on column receta_items.cantidad is
  'Piezas recetadas. Viene del AppSheet viejo; la impresión actual no la muestra.';

-- ----------------------------------------------------------------------------
-- 2. Renglones que no pudieron conservar su relación
--
-- El Excel trae referencias que apuntan a registros que no vienen en el archivo
-- (recetas, ventas y catálogo faltantes). No inventamos el vínculo ni tiramos el
-- renglón: se guarda completo, en crudo, para que alguien lo resuelva después.
-- ----------------------------------------------------------------------------
create table if not exists importacion_pendientes (
  id           uuid primary key default gen_random_uuid(),
  origen_datos text not null,
  hoja         text not null,   -- hoja del Excel de donde salió
  id_legacy    text,            -- su id en el sistema viejo
  motivo       text not null,   -- qué relación no se pudo resolver
  datos        jsonb not null,  -- el renglón original, íntegro
  creado_en    timestamptz not null default now()
);
comment on table importacion_pendientes is
  'Renglones importados que perdieron su relación. Se conservan en crudo, nunca se descartan en silencio.';
create index if not exists ix_import_pend_hoja on importacion_pendientes(hoja);

alter table importacion_pendientes enable row level security;

drop policy if exists "admin_all_importacion_pendientes" on importacion_pendientes;
create policy "admin_all_importacion_pendientes" on importacion_pendientes
  for all using (es_admin()) with check (es_admin());

drop policy if exists "clinica_lee_importacion_pendientes" on importacion_pendientes;
create policy "clinica_lee_importacion_pendientes" on importacion_pendientes
  for select using (current_rol() in ('admin','doctora','gerente'));

-- ============================================================================
-- REVERSA (ejecutar tal cual para deshacer esta migración)
--
-- do $$
-- declare t text;
-- begin
--   foreach t in array array[
--     'pacientes','historias_clinicas','recetas','receta_items','citas',
--     'productos','lotes','ventas','venta_items','pagos',
--     'proveedores','categorias','servicios',
--     'cobros','cobro_items','cobro_pagos'
--   ]
--   loop
--     execute format('alter table public.%I drop column if exists origen_datos;', t);
--     execute format('alter table public.%I drop column if exists es_historico;', t);
--   end loop;
-- end $$;
-- do $$
-- declare t text;
-- begin
--   foreach t in array array[
--     'categorias','proveedores','ventas','venta_items','pagos','cortes_caja',
--     'consultas','tratamientos'
--   ]
--   loop
--     execute format('alter table public.%I drop column if exists id_legacy;', t);
--   end loop;
-- end $$;
-- alter table receta_items drop column if exists cantidad;
-- drop table if exists importacion_pendientes;
-- ============================================================================
