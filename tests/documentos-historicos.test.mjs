import test from 'node:test';
import assert from 'node:assert/strict';
import { puedeLeerDocumentoHistorico } from '../src/lib/documentos-historicos.ts';

test('roles clínicos pueden consultar originales', () => {
  for (const rol of ['admin', 'doctora', 'asistente', 'gerente']) assert.equal(puedeLeerDocumentoHistorico(rol), true);
});

test('farmacia, sesión ausente y roles desconocidos no consultan originales', () => {
  for (const rol of ['farmacia', null, undefined, '', 'otro']) assert.equal(puedeLeerDocumentoHistorico(rol), false);
});
