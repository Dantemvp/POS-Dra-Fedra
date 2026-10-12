import test from 'node:test';
import assert from 'node:assert/strict';
import { contactosGoogle, datosContactoGoogle, unirAgenda } from '../src/lib/agenda-vista.ts';

const evento = (titulo, descripcion = '') => ({ id: 'sintetico', titulo, descripcion, inicio: '2026-10-20T10:00:00-07:00', diaCompleto: false });

test('motivo: solo texto explícito y sin mezclar teléfono o anticipo de las notas', () => {
  const [contacto] = contactosGoogle(evento('Persona Inventada $600', 'Nombre: Persona Inventada Servicio: valoración Tel: 6681234567 Anticipo: $600'));
  assert.equal(contacto.nombre, 'Persona Inventada');
  assert.equal(contacto.motivo, 'valoración');
  assert.equal(contacto.telefono, '+526681234567');
  assert.equal(contacto.adelanto, '$600');
  assert.equal(contactosGoogle(evento('Persona Inventada (P) S $500'))[0].motivo, undefined);
  assert.equal(contactosGoogle(evento('Persona Inventada $500 facial'))[0].motivo, 'facial');
});

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

test('formatos de Fer: códigos después del importe, antes del importe y cita sin importe', () => {
  for (const titulo of ['Persona Inventada $500 (P) N', 'Persona Inventada $1000 (PM*) s', 'Persona Inventada $1000, (P), S', 'Persona Inventada (W) $600 S', 'Persona Inventada (P) S $500', 'Persona Inventada $500 facial', 'Persona Inventada $600 (M)S']) {
    const contacto = contactosGoogle(evento(titulo))[0];
    assert.equal(contacto.nombre, 'Persona Inventada', titulo);
    assert.match(contacto.adelanto, /^\$/);
  }
  assert.equal(contactosGoogle(evento('Persona Inventada'))[0].nombre, 'Persona Inventada');
  assert.equal(contactosGoogle(evento('Persona Inventada Xeomeen'))[0].nombre, 'Persona Inventada');
});

test('cada persona tiene su mensaje y anticipo propio, sin compartir datos por accidente', () => {
  const contactos = contactosGoogle(evento('Persona Uno (p) $600/ Persona Dos (p,s) s'));
  assert.deepEqual(contactos.map(c => [c.nombre, c.adelanto, c.telefono]), [['Persona Uno', '$600', null], ['Persona Dos', undefined, null]]);
  const dosAnticipos = contactosGoogle(evento('Persona Uno $500 (P) s/ Persona Dos (P) $700 s'));
  assert.deepEqual(dosAnticipos.map(c => c.adelanto), ['$500', '$700']);
  assert.equal(contactosGoogle(evento('Persona Uno (P/S) $500 S')).length, 1);
});

test('notas en un solo renglón, teléfono sin etiqueta y enlace de WhatsApp', () => {
  assert.equal(datosContactoGoogle(evento('Persona Inventada $600', 'Nombre: Persona Inventada Tel: +52 668 123 4567 Anticipo: $600')).telefono_wpp, '+526681234567');
  assert.equal(datosContactoGoogle(evento('Persona Inventada 6681234567 $600 S')).telefono_wpp, '+526681234567');
  assert.equal(datosContactoGoogle(evento('Persona Inventada', '<a href="https://wa.me/526681234567">WhatsApp</a>')).telefono_wpp, '+526681234567');
});

test('notas con personas identificadas separan teléfonos; nota compartida no se reparte', () => {
  const contactos = contactosGoogle(evento('Persona Uno / Persona Dos', 'Nombre: Persona Uno\nTel: 6681234567\nNombre: Persona Dos\nTel: 6687654321'));
  assert.deepEqual(contactos.map(c => c.telefono), ['+526681234567', '+526687654321']);
  assert.deepEqual(contactosGoogle(evento('Persona Uno / Persona Dos', 'Tel: 6681234567')).map(c => c.telefono), [null, null]);
});

test('un cumpleaños o capacitación no se interpreta como nombre; conserva título y datos originales', () => {
  for (const titulo of ['Vuelo GDL', 'Capacitación Merz', 'Cumpleaños de Persona Inventada', 'Inauguraron RENNOVA']) assert.deepEqual(contactosGoogle(evento(titulo)), []);
  const original = evento('Persona Inventada $500 (P) S', '<b>Nota original</b>');
  const cita = unirAgenda([], [original])[0];
  assert.equal(cita.nombre, original.titulo);
  assert.equal(cita.descripcion, original.descripcion);
  assert.equal(cita.paciente_id, null);
});

test('nunca toma el teléfono del organizador como teléfono del paciente', () => {
  const e = {...evento('Persona Inventada'), invitados: [{nombre:'Organizador ficticio', organizador:true, comentario:'Tel: 6681234567'}]};
  assert.equal(datosContactoGoogle(e).telefono_wpp, null);
});
