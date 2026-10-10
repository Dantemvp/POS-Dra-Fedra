import test from 'node:test';
import assert from 'node:assert/strict';
import { puedeEditarPaciente, validarEdicionPaciente } from '../src/lib/paciente-edicion.ts';

test('solo perfiles clinicos editan datos de contacto', () => {
  for (const rol of ['admin','doctora','asistente','gerente']) assert.equal(puedeEditarPaciente(rol), true);
  for (const rol of ['farmacia', null, undefined, '', 'otro']) assert.equal(puedeEditarPaciente(rol), false);
});
test('normaliza datos y excluye identidad, origen y documentos del paquete', () => {
  const r = validarEdicionPaciente({nombre:' Persona ficticia ', apellidos:' Prueba ', telefono_wpp:'+52 (668) 123-4567', id:'otro', id_legacy:'otro', es_historico:false});
  assert.deepEqual(r, {ok:true, datos:{nombre:'Persona ficticia',apellidos:'Prueba',telefono_wpp:'526681234567'}});
});
test('permite quitar whatsapp y apellidos sin inventar datos', () => {
  assert.deepEqual(validarEdicionPaciente({nombre:'Prueba',apellidos:'',telefono_wpp:''}).datos,{nombre:'Prueba',apellidos:null,telefono_wpp:null});
});
test('rechaza nombre vacio, excesivo y whatsapp invalido', () => {
  for (const entrada of [{nombre:''},{nombre:'a'.repeat(151)},{nombre:'Prueba',telefono_wpp:'correo@test'},{nombre:'Prueba',telefono_wpp:'123'}]) assert.equal(validarEdicionPaciente(entrada).ok,false);
});
