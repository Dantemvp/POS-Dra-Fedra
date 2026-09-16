// Migración 045: las plantillas de receta por fase que salieron de los PDFs.
// Aquí solo se comprueba la integridad de la siembra. Que el contenido clínico
// sea correcto lo valida el consultorio contra sus hojas, no una prueba.
import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { contar, filas, leerMigracion } from "./fixtures/nom004.mjs";

const MIGRACION = leerMigracion("20260915000045_plantillas_receta.sql");

async function baseConPlantillas() {
  const db = new PGlite();
  await db.exec(`
    create type rol_usuario as enum ('admin','farmacia','doctora','asistente','gerente');
    create function current_rol() returns rol_usuario language sql stable as $$ select 'admin'::rol_usuario $$;
  `);
  await db.exec(MIGRACION);
  return db;
}

test("siembra 54 plantillas con 147 medicamentos", async () => {
  const db = await baseConPlantillas();
  assert.equal(await contar(db, "select count(*)::int as n from plantillas_receta"), 54);
  assert.equal(
    await contar(db, "select coalesce(sum(jsonb_array_length(items)),0)::int as n from plantillas_receta"),
    147,
  );
});

test("el reparto por carpeta cuadra con el material original", async () => {
  const db = await baseConPlantillas();
  const porCategoria = Object.fromEntries(
    (await filas(db, "select categoria, count(*)::int as n from plantillas_receta group by 1")).map(
      (r) => [r.categoria, Number(r.n)],
    ),
  );
  assert.deepEqual(porCategoria, {
    "FASE 1": 14,
    "FASE 2": 10,
    "FASE 3 y 4": 10,
    "FASE 5": 13,
    Mantenimiento: 1,
    RETOMAR: 6,
  });
});

test("ninguna plantilla llega vacía ni con un medicamento sin nombre", async () => {
  const db = await baseConPlantillas();
  assert.equal(
    await contar(db, "select count(*)::int as n from plantillas_receta where jsonb_array_length(items) = 0"),
    0,
  );
  assert.equal(
    await contar(
      db,
      `select count(*)::int as n from plantillas_receta p, jsonb_array_elements(p.items) i
        where coalesce(trim(i->>'medicamento'), '') = ''`,
    ),
    0,
  );
});

test("no se coló el nombre de la paciente que traía una de las hojas", async () => {
  const db = await baseConPlantillas();
  assert.equal(
    await contar(
      db,
      `select count(*)::int as n from plantillas_receta p, jsonb_array_elements(p.items) i
        where i->>'medicamento' ilike '%Brenda%'`,
    ),
    0,
  );
});

test("las duraciones caben en lo que acepta editar_receta", async () => {
  const db = await baseConPlantillas();
  assert.equal(
    await contar(
      db,
      `select count(*)::int as n from plantillas_receta p, jsonb_array_elements(p.items) i
        where (i->>'duracion_dias') is not null
          and (i->>'duracion_dias')::int not between 1 and 3650`,
    ),
    0,
    "la RPC rechaza cualquier duración fuera de 1..3650",
  );
});

test("33 plantillas traen impresa una fase distinta a la de su carpeta", async () => {
  const db = await baseConPlantillas();
  // No es un error a corregir aquí: se documenta para que el consultorio lo
  // resuelva. La prueba fija el número para que nadie lo cambie sin notarlo.
  assert.equal(
    await contar(
      db,
      `select count(*)::int as n from plantillas_receta
        where fase_texto ~ '^\\s*FASE\\s+[0-9]+'
          and not (substring(fase_texto from 'FASE\\s+([0-9]+)')::int = any(fases))`,
    ),
    33,
  );
});

test("es idempotente: correrla dos veces no duplica", async () => {
  const db = await baseConPlantillas();
  await db.exec(MIGRACION);
  assert.equal(await contar(db, "select count(*)::int as n from plantillas_receta"), 54);
});
