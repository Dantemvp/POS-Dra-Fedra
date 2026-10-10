import test from 'node:test';
import assert from 'node:assert/strict';
import { numeroWhatsApp, fechaMensajeCita, mensajeCita, enlacesWhatsApp } from '../src/lib/agenda-whatsapp.ts';

test('WhatsApp: normaliza México y conserva números internacionales', () => {
  assert.equal(numeroWhatsApp('(668) 123-4567'), '526681234567');
  assert.equal(numeroWhatsApp('+52 668 123 4567'), '526681234567');
  assert.equal(numeroWhatsApp('+5216681234567'), '526681234567');
  assert.equal(numeroWhatsApp('+1 202 555 0123'), '12025550123');
});
test('WhatsApp: rechaza notas, números cortos y entradas que no son teléfonos', () => {
  for (const valor of ['', '1234', 'teléfono 6681234567', '6681234567?text=otro', '00000000000', '1234567890123456']) assert.equal(numeroWhatsApp(valor), null);
});
test('WhatsApp: fecha y hora corresponden a Sinaloa y no a UTC', () => {
  assert.match(fechaMensajeCita('2026-10-12T01:30:00Z'), /domingo, 11 de octubre de 2026 a las 6:30/);
  assert.match(fechaMensajeCita('2026-10-12T01:30:00Z'), /hora de Sinaloa/);
});
test('WhatsApp: todo el día no inventa una hora; fecha inválida no genera mensaje', () => {
  assert.match(fechaMensajeCita('2026-10-11', true), /horario por confirmar/);
  assert.equal(fechaMensajeCita('inválida'), null);
  assert.equal(mensajeCita({ nombre: 'Persona ficticia', fecha: 'inválida', tipo: 'recordatorio' }), '');
});
test('WhatsApp: incluye saludo y confirmación sin inventar políticas', () => {
  const mensaje = mensajeCita({ nombre: 'Persona ficticia', fecha: '2026-10-11T18:00:00-07:00', tipo: 'recordatorio' });
  assert.match(mensaje, /Hola Persona ficticia\./);
  assert.match(mensaje, /Le recordamos/);
  assert.match(mensaje, /confirmar su asistencia/);
  assert.doesNotMatch(mensaje, /anticipo|cancelación|24 horas|48 horas|\$/);
});
test('WhatsApp: gracias por agendar y políticas solo cuando el operador las aporta', () => {
  const mensaje = mensajeCita({ nombre: 'Persona ficticia', fecha: '2026-10-11', tipo: 'agendamiento', politicas: 'Texto autorizado de prueba.' });
  assert.match(mensaje, /Gracias por agendar/);
  assert.match(mensaje, /Texto autorizado de prueba\./);
  assert.equal(mensajeCita({ nombre: ' ', fecha: '2026-10-11', tipo: 'recordatorio' }), '');
});
test('WhatsApp: app y web llevan el destinatario y mensaje exactos con signos y saltos', () => {
  const texto = 'Hola Persona ficticia.\n¿Confirma? & Gracias #1';
  const enlaces = enlacesWhatsApp('6681234567', texto);
  assert.equal(new URL(enlaces.app).pathname, '/526681234567');
  assert.equal(new URL(enlaces.web).searchParams.get('phone'), '526681234567');
  assert.equal(new URL(enlaces.app).searchParams.get('text'), texto);
  assert.equal(new URL(enlaces.web).searchParams.get('text'), texto);
  assert.equal(enlacesWhatsApp('6681234567', ' '), null);
  assert.equal(enlacesWhatsApp('no disponible', texto), null);
});
