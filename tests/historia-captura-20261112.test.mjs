import test from 'node:test';
import assert from 'node:assert/strict';
import { prepararCamposHistoria, elegirOpcionMultiple, validarMultiplesHistoria, campoVisible, campoVisibleEnEdicion, valoresParaEditar } from '../src/lib/historia-campos.ts';
import { baseConPlantilla, camposDeLaPlantilla, leerMigracion } from './fixtures/nom004.mjs';

test('Negado excluye familiares y desmarcarlo deja sin respuesta', () => {
  assert.deepEqual(elegirOpcionMultiple(['Madre', 'Padre'], 'Negado', true), ['Negado']);
  assert.deepEqual(elegirOpcionMultiple(['Negado'], 'Madre', true), ['Madre']);
  assert.deepEqual(elegirOpcionMultiple(['Negado'], 'Negado', false), []);
});

test('servidor rechaza contradicción sin convertir vacío en Negado y conserva texto histórico', () => {
  const campos = [{ id: 'diabetes', tipo_dato: 'multi', opciones: ['Madre', 'Negado'] }];
  assert.match(validarMultiplesHistoria(campos, { diabetes: ['Madre', 'Negado'] }), /Negado/);
  assert.equal(validarMultiplesHistoria(campos, { diabetes: [] }), null);
  assert.equal(validarMultiplesHistoria(campos, { diabetes: 'abuela' }, { diabetes: 'abuela' }), null);
  assert.ok(validarMultiplesHistoria(campos, { diabetes: 'abuela' }));
  assert.ok(validarMultiplesHistoria(campos, { diabetes: ['opción inventada'] }));
});

test('plantilla real conserva IDs y abre detalle de medicamentos con Sí, aunque síntomas sea No', async () => {
  const db = await baseConPlantilla();
  try {
    await db.exec(leerMigracion('20260915000044_hc_captura_rapida.sql'));
    const originales = await camposDeLaPlantilla(db);
    const campos = prepararCamposHistoria(originales);
    assert.deepEqual(campos.map(c => c.id), originales.map(c => c.id));
    for (const etiqueta of ['Enfermedades del corazón', 'Enfermedades del riñón', 'Inicio de la menstruación (edad)']) assert.ok(campos.some(c => c.etiqueta === etiqueta));
    const familiares = campos.filter(c => c.seccion.startsWith('II.') && c.tipo_dato === 'multi');
    assert.equal(familiares.length, 5);
    assert.ok(familiares.every(c => c.opciones.includes('Negado')));
    const padre = campos.find(c => c.etiqueta === '¿Toma algún medicamento actualmente?');
    const detalle = campos.find(c => c.etiqueta === '¿Cuáles medicamentos toma y en qué dosis?');
    const sintomas = campos.find(c => c.etiqueta.startsWith('¿Refiere alguna enfermedad'));
    assert.equal(campoVisible(detalle, { [padre.id]: true, [sintomas.id]: false }, 'F'), true);
    assert.equal(campoVisible(detalle, { [padre.id]: false }, 'F'), false);
    assert.equal(originales.find(c => c.id === detalle.id).etiqueta, 'Medicamentos actuales');
  } finally { await db.close(); }
});

test('editar solo motivo conserva detalles históricos sin Sí/No y gineco previo; No explícito retira detalle', () => {
  const campo = { id:'hijo', etiqueta:'Tabaquismo', tipo_dato:'texto', opciones:null, orden:2,requerido:false,depende_de:'padre',depende_valor:'true' };
  const gineco = { ...campo, id:'gineco',depende_de:null,solo_sexo:'F' };
  const anteriores = { hijo:'detalle antiguo',gineco:'dato anterior',motivo:'previo' };
  const edicion = { ...anteriores,motivo:'corrección' };
  assert.equal(campoVisibleEnEdicion(campo,edicion,'F',anteriores),true);
  assert.equal(campoVisibleEnEdicion(gineco,edicion,'M',anteriores),true);
  assert.deepEqual(valoresParaEditar([campo,gineco],edicion,anteriores),edicion);
  assert.equal(campoVisibleEnEdicion(campo,{...edicion,padre:false},'F',anteriores),false);
  assert.equal('hijo' in valoresParaEditar([campo],{...edicion,padre:false},anteriores),false);
});
