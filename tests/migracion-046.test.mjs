import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { contar, filas, leerMigracion } from "./fixtures/nom004.mjs";

const INICIAL = leerMigracion("20260915000045_plantillas_receta.sql");
const ACTUALIZACION = leerMigracion("20261008000046_actualizar_plantillas_receta.sql");

async function baseActualizada() {
  const db = new PGlite();
  await db.exec(`
    create type rol_usuario as enum ('admin','farmacia','doctora','asistente','gerente');
    create function current_rol() returns rol_usuario language sql stable as $$ select 'admin'::rol_usuario $$;
  `);
  await db.exec(INICIAL);
  await db.exec(ACTUALIZACION);
  return db;
}

test("reemplaza el catálogo visible por 61 plantillas y 161 medicamentos", async () => {
  const db = await baseActualizada();
  assert.equal(await contar(db, "select count(*)::int as n from plantillas_receta where activo"), 61);
  assert.equal(
    await contar(db, "select sum(jsonb_array_length(items))::int as n from plantillas_receta where activo"),
    161,
  );
});

test("el reparto activo coincide con las seis carpetas entregadas", async () => {
  const db = await baseActualizada();
  const reparto = Object.fromEntries(
    (await filas(db, "select categoria, count(*)::int as n from plantillas_receta where activo group by 1"))
      .map((fila) => [fila.categoria, Number(fila.n)]),
  );
  assert.deepEqual(reparto, {
    "FASE 1": 14,
    "FASE 2": 12,
    "FASE 3 y 4": 10,
    "FASE 5": 10,
    Mantenimiento: 1,
    RETOMAR: 14,
  });
});

test("ninguna plantilla activa queda vacía o con medicamento sin nombre", async () => {
  const db = await baseActualizada();
  assert.equal(
    await contar(db, `select count(*)::int as n from plantillas_receta
      where activo and (jsonb_typeof(items) <> 'array' or jsonb_array_length(items) = 0)`),
    0,
  );
  assert.equal(
    await contar(db, `select count(*)::int as n from plantillas_receta p,
      jsonb_array_elements(p.items) i
      where p.activo and coalesce(trim(i->>'medicamento'), '') = ''`),
    0,
  );
});

test("el extractor no incorpora nombre, edad ni fecha del paciente", async () => {
  const fuente = JSON.parse(
    await import("node:fs/promises").then((fs) => fs.readFile("scripts/plantillas-20261008.json", "utf8")),
  );
  const serializado = JSON.stringify(fuente);
  assert.doesNotMatch(serializado, /NOMBRE\s*:/i);
  assert.ok(fuente.every((plantilla) => ["paciente", "fecha", "edad"].every(clave => !(clave in plantilla))));
});

test("la actualización es idempotente", async () => {
  const db = await baseActualizada();
  await db.exec(ACTUALIZACION);
  assert.equal(await contar(db, "select count(*)::int as n from plantillas_receta where activo"), 61);
  assert.equal(
    await contar(db, "select sum(jsonb_array_length(items))::int as n from plantillas_receta where activo"),
    161,
  );
});

test("conserva las ediciones anteriores y las plantillas personalizadas", async () => {
  const db = new PGlite();
  await db.exec(`create type rol_usuario as enum ('admin','farmacia','doctora','asistente','gerente');
    create function current_rol() returns rol_usuario language sql stable as $$ select 'admin'::rol_usuario $$;`);
  await db.exec(INICIAL);
  await db.exec(`update plantillas_receta set items = '[{"medicamento":"EDICION SINTETICA"}]' where categoria='FASE 1' and nombre='PASTILLA FASE 1';
    insert into plantillas_receta(categoria,nombre,items) values ('FASE 1','PERSONALIZADA SINTETICA','[{"medicamento":"PRUEBA"}]');
    insert into plantillas_receta(categoria,nombre,items) values ('FASE 1','PERSONALIZADA VACIA','[]');`);
  await db.exec(ACTUALIZACION);
  assert.equal(await contar(db, `select count(*)::int as n from plantillas_receta where nombre='PERSONALIZADA SINTETICA' and activo`), 1);
  assert.equal(await contar(db, `select count(*)::int as n from plantillas_receta where nombre='PERSONALIZADA VACIA' and activo and items='[]'::jsonb`), 1);
  const previas = await filas(db, `select versiones_anteriores from plantillas_receta where categoria='FASE 1' and nombre='PASTILLA FASE 1'`);
  assert.match(JSON.stringify(previas), /EDICION SINTETICA/);
  await db.exec(`update plantillas_receta set items='[{"medicamento":"EDICION POSTERIOR"}]' where categoria='FASE 1' and nombre='PASTILLA FASE 1'`);
  await db.exec(ACTUALIZACION);
  const posteriores = await filas(db, `select items, versiones_anteriores from plantillas_receta where categoria='FASE 1' and nombre='PASTILLA FASE 1'`);
  assert.match(JSON.stringify(posteriores), /EDICION POSTERIOR/);
  assert.match(JSON.stringify(posteriores), /EDICION SINTETICA/);
});
