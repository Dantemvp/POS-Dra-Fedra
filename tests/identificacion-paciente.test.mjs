import test from 'node:test';
import assert from 'node:assert/strict';
import { validarIdentificacion, idPacienteValido, nombreIdentificacionValido, puedeGestionarIdentificacion } from '../src/lib/identificacion-paciente.ts';

const pdf = new TextEncoder().encode('%PDF-1.4\n1 0 obj <</Type/Catalog>> endobj\n%%EOF\n');
test('permite PDF y fotos por contenido y rechaza nombres o tipos disfrazados', () => {
  assert.deepEqual(validarIdentificacion('doc.pdf','application/pdf',pdf), { extension: 'pdf',mime:'application/pdf' });
  assert.throws(() => validarIdentificacion('doc.jpg','image/jpeg',pdf),/no coincide/);
  assert.throws(() => validarIdentificacion('doc.pdf','text/html',pdf),/no coincide/);
  assert.throws(() => validarIdentificacion('doc.pdf','application/pdf',pdf.slice(0,25)),/completo/);
  assert.throws(() => validarIdentificacion('foto.svg','image/svg+xml',new TextEncoder().encode('<svg><script>alert(1)</script></svg>')),/completo/);
  assert.throws(() => validarIdentificacion('doc.pdf','application/pdf',new Uint8Array(4194305)),/4 MB/);
});
test('solo roles clínicos, IDs válidos y nombres opacos, sin acceso a otras rutas', () => {
  for (const rol of ['admin','doctora','asistente','gerente']) assert.equal(puedeGestionarIdentificacion(rol),true);
  for (const rol of ['farmacia','otro',null,undefined]) assert.equal(puedeGestionarIdentificacion(rol),false);
  assert.equal(idPacienteValido('00000000-0000-0000-0000-000000000001'),true);
  assert.equal(idPacienteValido('../otro'),false);
  assert.equal(nombreIdentificacionValido('frente-00000000-0000-0000-0000-000000000001.jpg'),true);
  for (const nombre of ['../otro.pdf','persona.pdf','otra-00000000-0000-0000-0000-000000000001.svg','otra-00000000-0000-0000-0000-000000000001.pdf/otro']) assert.equal(nombreIdentificacionValido(nombre),false);
});
