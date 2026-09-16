// Migración 044: captura rápida de la historia clínica.
// Lo que se prueba es que solo toque la plantilla cuando está exactamente como
// la espera, y que un reintento sea inofensivo.
import test from "node:test";
import assert from "node:assert/strict";
import {
  baseConPlantilla,
  camposDeLaPlantilla,
  contar,
  existeColumna,
  filas,
  leerMigracion,
  retrato,
} from "./fixtures/nom004.mjs";

const MIGRACION = leerMigracion("20260915000044_hc_captura_rapida.sql");
const CAMPOS = "select count(*)::int as n from campos_historia";

test("sobre la plantilla intacta: 55 campos entran y quedan 67", async () => {
  const db = await baseConPlantilla();
  assert.equal(await contar(db, CAMPOS), 55, "la plantilla base trae 55 campos");

  await db.exec(MIGRACION);

  assert.equal(await contar(db, CAMPOS), 67, "10 preguntas sí/no, la general y el IMC");
  assert.equal(
    await contar(db, "select count(*)::int as n from campos_historia where depende_de is not null"),
    16,
    "16 campos quedan colgados de una pregunta",
  );
  assert.equal(
    await contar(db, "select count(*)::int as n from campos_historia where solo_sexo = 'F'"),
    8,
    "los 8 ginecoobstétricos quedan marcados",
  );
  assert.equal(
    await contar(db, "select count(*)::int as n from campos_historia where oculto"),
    2,
    "tipo sanguíneo y toxicomanías salen de la captura",
  );
  assert.equal(
    await contar(db, "select count(*)::int as n from campos_historia where rol = 'imc'"),
    1,
  );

  // Cada pregunta va inmediatamente antes del campo que abre.
  const pares = await filas(
    db,
    `select p.orden as padre, h.orden as hijo
       from campos_historia h join campos_historia p on p.id = h.depende_de`,
  );
  for (const par of pares) {
    assert.ok(Number(par.padre) < Number(par.hijo), "la pregunta se imprime antes que su detalle");
  }
});

test("si una etiqueta ya cambió: aborta y no deja ni un cambio", async () => {
  const db = await baseConPlantilla();
  await db.exec(
    `update campos_historia set etiqueta = 'Tabaquismo y otras adicciones'
      where etiqueta = 'Tabaquismo'`,
  );

  const antes = await retrato(db);
  await assert.rejects(
    () => db.exec(MIGRACION),
    /Tabaquismo/,
    "la precondición nombra el campo que ya no encuentra",
  );

  assert.equal(await retrato(db), antes, "ninguna fila cambió");
  assert.equal(await contar(db, CAMPOS), 55, "no se insertó ninguna pregunta");
  assert.equal(
    await existeColumna(db, "campos_historia", "rol"),
    false,
    "aborta antes de los ALTER, así que ni las columnas nuevas quedaron",
  );
});

test("si hay dos plantillas con el mismo nombre: aborta", async () => {
  const db = await baseConPlantilla();
  await db.exec(`insert into tipos_historia (nombre) values ('Historia Clínica (NOM-004)')`);
  const antes = await retrato(db);

  await assert.rejects(() => db.exec(MIGRACION), /exactamente una/);
  assert.equal(await retrato(db), antes);
});

test("si alguien agregó un campo a la plantilla: aborta en vez de adivinar", async () => {
  const db = await baseConPlantilla();
  await db.exec(
    `insert into campos_historia (tipo_historia_id, seccion, etiqueta, tipo_dato, orden)
     select id, 'I. Identificación', 'Referido por', 'texto', 6
       from tipos_historia where nombre = 'Historia Clínica (NOM-004)'`,
  );
  const antes = await retrato(db);

  await assert.rejects(() => db.exec(MIGRACION), /56 campos/);
  assert.equal(await retrato(db), antes);
});

test("IMC preexistente puesto a mano: aborta y no agrega columnas", async () => {
  // La marca de "ya aplicada" es un campo IMC en la ficha clínica. Si alguien
  // lo agregó por su cuenta, la migración no debe darse por hecha: terminaría
  // bien sin instalar la captura rápida.
  const db = await baseConPlantilla();
  await db.exec(
    `insert into campos_historia (tipo_historia_id, seccion, etiqueta, tipo_dato, orden)
     select id, 'IX. Ficha clínica', 'IMC', 'numero', 76
       from tipos_historia where nombre = 'Historia Clínica (NOM-004)'`,
  );
  const antes = await retrato(db);

  await assert.rejects(() => db.exec(MIGRACION), /no corresponde a una aplicación completa/);

  assert.equal(await retrato(db), antes, "ninguna fila cambió");
  assert.equal(await contar(db, CAMPOS), 56, "sigue con sus 56 campos");
  assert.equal(
    await existeColumna(db, "campos_historia", "rol"),
    false,
    "aborta antes de los ALTER",
  );
  assert.equal(
    await contar(db, "select count(*)::int as n from campos_historia where etiqueta like '¿%'"),
    0,
    "no se instaló ninguna pregunta",
  );
});

test("IMC preexistente con la plantilla ya migrada encima: sigue abortando", async () => {
  // Caso mixto: la migración corrió, y después alguien agregó otro IMC. El
  // conteo deja de cuadrar y un reintento no debe pasar de largo.
  const db = await baseConPlantilla();
  await db.exec(MIGRACION);
  await db.exec(
    `insert into campos_historia (tipo_historia_id, seccion, etiqueta, tipo_dato, orden)
     select id, 'IX. Ficha clínica', 'IMC', 'numero', 999
       from tipos_historia where nombre = 'Historia Clínica (NOM-004)'`,
  );
  const antes = await retrato(db);

  await assert.rejects(() => db.exec(MIGRACION), /no corresponde a una aplicación completa/);
  assert.equal(await retrato(db), antes);
});

test("segundo intento tras una corrida completa: no duplica nada", async () => {
  const db = await baseConPlantilla();
  await db.exec(MIGRACION);
  const despuesDelPrimero = await retrato(db);

  await db.exec(MIGRACION);

  assert.equal(await retrato(db), despuesDelPrimero, "la segunda corrida no cambia nada");
  assert.equal(await contar(db, CAMPOS), 67);
  assert.equal(
    await contar(db, "select count(*)::int as n from campos_historia where etiqueta = 'IMC'"),
    1,
    "un solo IMC",
  );
  assert.equal(
    await contar(db, "select count(*)::int as n from campos_historia where etiqueta = '¿Fuma?'"),
    1,
    "una sola pregunta de tabaquismo",
  );
});

test("ningún campo existente cambia de tipo salvo los tres que pasan a lista", async () => {
  const db = await baseConPlantilla();
  const antes = new Map(
    (await filas(db, "select id, tipo_dato from campos_historia")).map((c) => [c.id, c.tipo_dato]),
  );

  await db.exec(MIGRACION);

  const cambiados = (await camposDeLaPlantilla(db))
    .filter((c) => antes.has(c.id) && antes.get(c.id) !== c.tipo_dato)
    .map((c) => c.etiqueta)
    .sort();
  assert.deepEqual(cambiados, ["Escolaridad", "Estado civil", "Religión"]);
});
