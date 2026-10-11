import test from 'node:test';
import assert from 'node:assert/strict';
import { datosContactoGoogle, unirAgenda } from '../src/lib/agenda-vista.ts';

const evento = (titulo, descripcion = '') => ({ id: 'sintetico', titulo, descripcion, inicio: '2026-10-20T10:00:00-07:00', diaCompleto: false });

test('convención de Fer: importe final es anticipo y el prefijo es contacto, no expediente', () => {
  const e = evento('Persona Inventada $600');
  const datos = datosContactoGoogle(e);
  assert.equal(datos.nombre_contacto, 'Persona Inventada');
  assert.equal(datos.adelanto_google, '$600');
  assert.equal(unirAgenda([], [e])[0].paciente_id, null);
  assert.equal(unirAgenda([], [e])[0].nombre, e.titulo);
});

test('conserva anticipo con código final sin interpretar el código', () => {
  assert.equal(datosContactoGoogle(evento('Persona Inventada $1,200.50 (P)')).adelanto_google, '$1,200.50');
});

test('notas explícitas precargan teléfono y nombre; importes no finales no se infieren', () => {
  const datos = datosContactoGoogle(evento('Consulta', 'Nombre: Persona Inventada<br>Teléfono: 6681234567<br>Anticipo: $600'));
  assert.equal(datos.nombre_contacto, 'Persona Inventada');
  assert.equal(datos.telefono_wpp, '+526681234567');
  assert.equal(datos.adelanto_google, '$600');
  assert.equal(datosContactoGoogle(evento('$600 consulta')).adelanto_google, undefined);
});

test('varios destinatarios requieren revisión sin perder las notas', () => {
  const datos = datosContactoGoogle(evento('Consulta', 'Tel: 6681234567\nTel: 6687654321'));
  assert.equal(datos.contacto_ambiguo, true);
  assert.equal(datos.telefono_wpp, null);
  assert.equal(datosContactoGoogle(evento('Persona Uno / Persona Dos $600')).nombre_contacto, undefined);
});

test('campos adicionales conservan texto y permiten extraer contacto', () => {
  const e = { ...evento('Consulta'), campos: [{ origen: 'private', clave: 'phone', valor: '+1 202 555 0123' }] };
  const c = unirAgenda([], [e])[0];
  assert.equal(c.telefono_wpp, '+12025550123');
  assert.deepEqual(c.campos, e.campos);
});
