import fs from "node:fs";

const entrada = process.argv[2];
const salida = process.argv[3];
if (!entrada || !salida) {
  throw new Error("Uso: node scripts/plantillas-generar-actualizacion.mjs <plantillas.json> <migracion.sql>");
}

const plantillas = JSON.parse(fs.readFileSync(entrada, "utf8"));
const FASES_POR_CARPETA = {
  "FASE 1": [1],
  "FASE 2": [2],
  "FASE 3 y 4": [3, 4],
  "FASE 5": [5],
  Mantenimiento: [],
  RETOMAR: [],
};
const ORDEN = ["FASE 1", "FASE 2", "FASE 3 y 4", "FASE 5", "Mantenimiento", "RETOMAR"];
const q = (valor) => valor == null ? "null" : `'${String(valor).replace(/'/g, "''")}'`;
const anterior = fs.readFileSync(new URL("../supabase/migrations/20260915000045_plantillas_receta.sql", import.meta.url), "utf8");
const semillas = [...anterior.matchAll(/^\s*\('([^']*)', '([^']*)', array/gm)].map(m => [m[1], m[2]]);
if (semillas.length !== 54) throw new Error("No se identificaron las 54 plantillas originales.");
const pares = semillas.map(([categoria, nombre]) => `(${q(categoria)}, ${q(nombre)})`).join(",\n");

if (plantillas.length === 0) throw new Error("No hay plantillas para actualizar.");
for (const plantilla of plantillas) {
  if (!FASES_POR_CARPETA[plantilla.categoria]) throw new Error(`Categoría desconocida: ${plantilla.categoria}`);
  if (!plantilla.items?.length) throw new Error(`Plantilla sin medicamentos: ${plantilla.categoria}/${plantilla.nombre}`);
  if (plantilla.items.some((item) => !item.medicamento?.trim())) {
    throw new Error(`Plantilla con medicamento vacío: ${plantilla.categoria}/${plantilla.nombre}`);
  }
}

const filas = plantillas
  .slice()
  .sort((a, b) => ORDEN.indexOf(a.categoria) - ORDEN.indexOf(b.categoria) || a.nombre.localeCompare(b.nombre, "es"))
  .map((plantilla, indice) => {
    const fases = FASES_POR_CARPETA[plantilla.categoria];
    return `  (${q(plantilla.categoria)}, ${q(plantilla.nombre)}, array[${fases.join(",")}]::int[], ${q(plantilla.fase_texto)}, ${q(JSON.stringify(plantilla.items))}::jsonb, ${indice * 10}, true)`;
  });

const sql = `-- Plantillas actualizadas entregadas por el consultorio el 8 de octubre de 2026.
-- Fuente: 62 PDF AcroForm; 61 tratamientos y un recetario vacío excluido.
-- Guarda la versión previa de las semillas y de las filas que actualiza.
-- Conserva activas las plantillas personalizadas. No modifica recetas emitidas.

begin;

lock table public.plantillas_receta in share row exclusive mode;
alter table public.plantillas_receta add column if not exists versiones_anteriores jsonb not null default '[]'::jsonb;
alter table public.plantillas_receta add column if not exists origen_actualizacion text;

update public.plantillas_receta p
set versiones_anteriores = p.versiones_anteriores || jsonb_build_array(to_jsonb(p) - 'versiones_anteriores'),
    origen_actualizacion = 'archivo-20261008'
where p.origen_actualizacion is null and (p.categoria, p.nombre) in (
${pares},
${plantillas.map(p => `(${q(p.categoria)}, ${q(p.nombre)})`).join(",\n")}
);

update public.plantillas_receta set activo = false
where origen_actualizacion = 'archivo-20261008' and (categoria, nombre) in (
${pares}
);

insert into public.plantillas_receta
  (categoria, nombre, fases, fase_texto, items, orden, activo, origen_actualizacion)
values
${filas.map(fila => fila.slice(0, -1) + ", '20261008')").join(",\n")}
on conflict (categoria, nombre) do update set
  fases = excluded.fases,
  fase_texto = excluded.fase_texto,
  items = excluded.items,
  orden = excluded.orden,
  activo = true,
  origen_actualizacion = '20261008'
where plantillas_receta.origen_actualizacion is distinct from '20261008';

do $$
declare
  activas int;
  vacias int;
begin
  select count(*) into activas from public.plantillas_receta where origen_actualizacion = '20261008';
  select count(*) into vacias
  from public.plantillas_receta
  where activo and (jsonb_typeof(items) <> 'array' or jsonb_array_length(items) = 0);
  if activas <> ${plantillas.length} or vacias <> 0 then
    raise exception 'Actualización de plantillas incompleta: activas=%, vacias=%', activas, vacias;
  end if;
end $$;

commit;
`;

fs.writeFileSync(salida, sql, "utf8");
console.log(`${plantillas.length} plantillas escritas en ${salida}`);
