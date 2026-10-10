import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { leerMigracion } from './fixtures/nom004.mjs';
import { campoVisible, valoresParaGuardar } from '../src/lib/historia-campos.ts';

const sql = leerMigracion('20261009000048_hc_inhibidores_detalle.sql');
async function base(t) {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`create table campos_historia (
    id uuid primary key default gen_random_uuid(), tipo_historia_id uuid not null,
    etiqueta text, tipo_dato text, orden int, requerido boolean, seccion text,
    depende_de uuid references campos_historia(id), depende_valor text);
    insert into campos_historia (tipo_historia_id, etiqueta, tipo_dato, orden, seccion)
    values ('00000000-0000-0000-0000-000000000001', '¿Ha consumido inhibidores del apetito?', 'booleano', 3, 'Antecedentes'),
    ('00000000-0000-0000-0000-000000000001', 'Siguiente', 'texto', 4, 'Antecedentes');`);
  return db;
}
async function retrato(db) { return (await db.query('select * from campos_historia order by id')).rows; }

test('048 agrega un detalle inmediato, conserva los campos y permite reintentar', async t => {
  const db = await base(t);
  await db.exec(sql);
  const campos = await retrato(db);
  const padre = campos.find(c => c.tipo_dato === 'booleano');
  const hijo = campos.find(c => c.depende_de);
  assert.equal(campos.length, 3);
  assert.equal(hijo.depende_de, padre.id);
  assert.equal(hijo.orden, 4);
  assert.equal(campos.find(c => c.etiqueta === 'Siguiente').orden, 5);
  assert.equal(hijo.requerido, false);
  await db.exec(sql);
  assert.deepEqual(await retrato(db), campos);
  assert.equal(campoVisible(hijo, { [padre.id]: true }, 'F'), true);
  assert.equal(campoVisible(hijo, { [padre.id]: false }, 'F'), false);
  assert.deepEqual(valoresParaGuardar([hijo], { [padre.id]: false, [hijo.id]: 'Prueba' }, 'F'), { [padre.id]: false });
  assert.equal(valoresParaGuardar([hijo], { [padre.id]: true, [hijo.id]: 'Prueba' }, 'F')[hijo.id], 'Prueba');
});

test('048 sin pregunta aborta sin cambiar campos', async t => {
  const db = await base(t);
  await db.exec("delete from campos_historia where tipo_dato = 'booleano'");
  const antes = await retrato(db);
  await assert.rejects(db.exec(sql), /No existe la pregunta/);
  assert.deepEqual(await retrato(db), antes);
});

test('048 pregunta duplicada aborta sin cambios', async t => {
  const db = await base(t);
  await db.exec('insert into campos_historia (tipo_historia_id, etiqueta, tipo_dato, orden) select tipo_historia_id, etiqueta, tipo_dato, orden from campos_historia where tipo_dato = \'booleano\'');
  const antes = await retrato(db);
  await assert.rejects(db.exec(sql), /ambigua/);
  assert.deepEqual(await retrato(db), antes);
});

test('048 no sobrescribe un detalle personalizado', async t => {
  const db = await base(t);
  await db.exec(`insert into campos_historia (tipo_historia_id, etiqueta, tipo_dato, orden)
    select tipo_historia_id, '¿Cuáles inhibidores del apetito ha consumido?', 'texto', 20 from campos_historia where tipo_dato = 'booleano'`);
  const antes = await retrato(db);
  await assert.rejects(db.exec(sql), /configuración distinta/);
  assert.deepEqual(await retrato(db), antes);
});
