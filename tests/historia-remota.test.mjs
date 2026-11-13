import test from 'node:test';
import assert from 'node:assert/strict';
import { crearCamposRemotos, importarRespuestasRemotas, textoRespuestasRemotas, validarArchivoRemoto } from '../src/lib/historia-remota.ts';
import { prepararCamposHistoria } from '../src/lib/historia-campos.ts';
import { baseConPlantilla, camposDeLaPlantilla, leerMigracion } from './fixtures/nom004.mjs';

async function plantilla(t) {
  const db = await baseConPlantilla(); t.after(() => db.close());
  await db.exec(leerMigracion('20260915000044_hc_captura_rapida.sql'));
  return prepararCamposHistoria(await camposDeLaPlantilla(db));
}
const sobre = respuestas => JSON.stringify({ formato: 'fedra-historia-paciente', version: 1, nombre: 'Persona ficticia', fecha_nac: null, sexo: null, respuestas });

test('ida y vuelta parcial conserva No y cero, sin UUID, valores por omisión ni diagnóstico automático', async t => {
  const destino = await plantilla(t); const publicos = crearCamposRemotos(destino);
  assert.ok(publicos.length > 40);
  assert.ok(publicos.every(c => c.valor_default === null && !c.requerido));
  assert.ok(publicos.every(c => !destino.some(d => d.id === c.id)));
  assert.ok(!publicos.some(c => c.seccion.startsWith('IX.') || c.seccion.startsWith('XI.')));
  const alcohol = publicos.find(c => c.etiqueta === '¿Toma alcohol?');
  const parejas = publicos.find(c => c.etiqueta === 'No. parejas sexuales');
  const archivo = validarArchivoRemoto(sobre({ [alcohol.id]: false, [parejas.id]: 0 }), publicos);
  const importados = importarRespuestasRemotas(archivo, publicos, destino);
  assert.equal(importados[destino.find(c => c.etiqueta === alcohol.etiqueta).id], false);
  assert.equal(importados[destino.find(c => c.etiqueta === parejas.etiqueta).id], 0);
  assert.equal(Object.keys(importados).length,2);
  assert.match(textoRespuestasRemotas(archivo,publicos), /alcohol\?: No/);
});

test('archivo manipulado rechaza tamaño, versión, tipo, preguntas, contradicción y dato oculto', async t => {
  const campos = crearCamposRemotos(await plantilla(t));
  const familiar = campos.find(c => c.tipo_dato === 'multi');
  const hijo = campos.find(c => c.depende_de);
  assert.throws(() => validarArchivoRemoto('x'.repeat(65537),campos),/64 KB/);
  assert.throws(() => validarArchivoRemoto(sobre({ inventada: false }),campos),/desconocida/);
  assert.throws(() => validarArchivoRemoto(sobre({ [familiar.id]: ['Negado','Madre'] }),campos),/Revisa la respuesta/);
  assert.throws(() => validarArchivoRemoto(sobre({ [hijo.id]: 'dato', [hijo.depende_de]: false }),campos),/contradictoria/);
  assert.throws(() => validarArchivoRemoto(sobre({}).replace('"version":1','"version":2'),campos),/versión/);
  assert.throws(() => validarArchivoRemoto(sobre({ [familiar.id]: 'Negado' }),campos),/Revisa la respuesta/);
});

test('cambios de plantilla no pierden preguntas ni inventan campos al importar', async t => {
  const destino = await plantilla(t); const publicos = crearCamposRemotos(destino);
  const c = publicos[0]; const archivo = validarArchivoRemoto(sobre({ [c.id]: '2026-11-13' }),publicos);
  assert.throws(() => importarRespuestasRemotas(archivo,publicos,[]),/No se pudo ubicar/);
  assert.throws(() => crearCamposRemotos([...destino,destino[0]]),/duplicadas/);
});
