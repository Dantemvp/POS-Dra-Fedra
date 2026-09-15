import fs from "node:fs";

const plantillas = JSON.parse(fs.readFileSync("plantillas.json", "utf8"));

// Las fases que cubre cada carpeta. Sale del nombre de la carpeta, que es lo
// único que ordena el material; la etiqueta impresa en varias hojas dice otra
// cosa y esa discrepancia la tiene que resolver el consultorio.
const FASES_POR_CARPETA = {
  "FASE 1": [1],
  "FASE 2": [2],
  "FASE 3 y 4": [3, 4],
  "FASE 5": [5],
  Mantenimiento: [],
  RETOMAR: [],
};

const ORDEN_CATEGORIA = ["FASE 1", "FASE 2", "FASE 3 y 4", "FASE 5", "Mantenimiento", "RETOMAR"];

const q = (s) => (s === null || s === undefined ? "null" : `'${String(s).replace(/'/g, "''")}'`);

const filas = plantillas
  .slice()
  .sort((a, b) =>
    ORDEN_CATEGORIA.indexOf(a.categoria) - ORDEN_CATEGORIA.indexOf(b.categoria) ||
    a.nombre.localeCompare(b.nombre, "es"))
  .map((p, i) => {
    const fases = FASES_POR_CARPETA[p.categoria];
    if (!fases) throw new Error(`Carpeta sin mapa de fases: ${p.categoria}`);
    const items = p.items.map((it) => ({
      medicamento: it.medicamento,
      dosis: it.dosis,
      duracion_dias: it.duracion_dias,
      indicaciones: it.indicaciones,
    }));
    return `  (${q(p.categoria)}, ${q(p.nombre)}, array[${fases.join(",")}]::int[], ${q(p.fase_texto)}, ${q(JSON.stringify(items))}::jsonb, ${i * 10})`;
  });

const sql = `-- ============================================================================
-- Plantillas de receta por fase (reunión del 15 de septiembre de 2026).
--
-- Mayira entregó 55 recetarios en PDF organizados en carpetas por fase. Aquí
-- quedan como plantillas seleccionables: Fernanda elige la categoría, elige la
-- combinación y la receta llega precargada, que es justo lo que hoy resuelve
-- copiando y pegando de archivos sueltos.
--
-- Dos cosas del material original que NO se corrigen aquí a propósito:
--
--  1. La carpeta y la etiqueta impresa no coinciden, y es sistemático: las diez
--     hojas de "FASE 2" dicen FASE 3, las diez de "FASE 3 y 4" dicen FASE 5 y
--     las trece de "FASE 5" dicen FASE 1. Se guardan las dos: \`categoria\` es la
--     carpeta y \`fase_texto\` es lo que dice la hoja. La pantalla avisa cuando
--     difieren. Cuál manda lo decide el consultorio, no el importador.
--
--  2. "DESTETE COMBINADO WEGOBY" lista Wegovy 0.5 mg y Wegovy 0.25 mg, y solo
--     la segunda trae dosis. Se respeta tal cual viene.
--
-- Se excluyeron el recetario en blanco y los datos de una paciente que habían
-- quedado escritos sobre el membrete de una de las hojas.
-- ============================================================================

create table if not exists plantillas_receta (
  id          uuid primary key default gen_random_uuid(),
  categoria   text not null,
  nombre      text not null,
  fases       int[] not null default '{}',
  fase_texto  text,
  items       jsonb not null default '[]'::jsonb,
  orden       int not null default 0,
  activo      boolean not null default true,
  creado_en   timestamptz not null default now()
);

comment on table plantillas_receta is 'Combinaciones prearmadas de la doctora, por fase. Editables sin programador.';
comment on column plantillas_receta.categoria is 'Carpeta de origen del material: FASE 1, FASE 2, FASE 3 y 4, FASE 5, Mantenimiento, RETOMAR.';
comment on column plantillas_receta.fase_texto is 'Etiqueta tal como viene impresa en la hoja. Puede no coincidir con la categoría.';

create unique index if not exists plantillas_receta_categoria_nombre
  on plantillas_receta (categoria, nombre);

alter table plantillas_receta enable row level security;

drop policy if exists "plantillas_lectura" on plantillas_receta;
create policy "plantillas_lectura" on plantillas_receta
  for select using (current_rol() is not null);

drop policy if exists "plantillas_escritura" on plantillas_receta;
create policy "plantillas_escritura" on plantillas_receta
  for all using (current_rol()::text in ('admin', 'doctora', 'gerente'))
  with check (current_rol()::text in ('admin', 'doctora', 'gerente'));

insert into plantillas_receta (categoria, nombre, fases, fase_texto, items, orden) values
${filas.join(",\n")}
on conflict (categoria, nombre) do nothing;
`;

fs.writeFileSync("20260915000045_plantillas_receta.sql", sql, "utf8");
console.log(`migración generada: ${filas.length} plantillas, ${sql.length} bytes`);
