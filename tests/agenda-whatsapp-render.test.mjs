import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { whatsappModuleUrl } from './helpers/whatsapp-render.mjs';
const { FormularioWhatsApp } = await import(whatsappModuleUrl);
const fecha = '2026-10-11T18:00:00-07:00';

test('WhatsApp render: paciente del POS tiene borrador y enlaces, no se envía automáticamente', () => {
  const html = renderToStaticMarkup(React.createElement(FormularioWhatsApp, { nombre: 'Persona ficticia', telefono: '6681234567', fecha }));
  assert.match(html, /Hola%20Persona%20ficticia/);
  assert.match(html, /https:\/\/wa.me\/526681234567/);
  assert.doesNotMatch(html, /https:\/\/web.whatsapp.com\/send/);
  assert.match(html, /Abrir el chat no envía el mensaje ni confirma la cita/);
  assert.match(html, /Editar mensaje/);
  assert.doesNotMatch(html, /<textarea|<input/);
  assert.doesNotMatch(html, /localStorage|sessionStorage/);
});
test('WhatsApp render: Google pide solo teléfono y no crea enlaces sin número', () => {
  const html = renderToStaticMarkup(React.createElement(FormularioWhatsApp, { fecha, google: true }));
  assert.match(html, /Número de WhatsApp/);
  assert.match(html, /Enviar WhatsApp/);
  assert.equal((html.match(/<input/g) ?? []).length, 1);
  assert.doesNotMatch(html, /Nombre de la persona|<textarea/);
  assert.doesNotMatch(html, /href=/);
});
test('WhatsApp render: Google con teléfono abre mensaje genérico sin usar el título como nombre', () => {
  const html = renderToStaticMarkup(React.createElement(FormularioWhatsApp, { fecha, google: true, nombre: 'Dos personas / nota privada', telefono: '6681234567' }));
  assert.match(html, /https:\/\/wa.me\/526681234567/);
  assert.match(html, /Hola\./);
  assert.doesNotMatch(html, /Dos personas|nota privada|<input|<textarea/);
});
test('WhatsApp render: fecha inválida no ofrece enlace aunque tenga teléfono', () => {
  const html = renderToStaticMarkup(React.createElement(FormularioWhatsApp, { fecha: 'no-fecha', telefono: '6681234567' }));
  assert.doesNotMatch(html, /href=/);
  assert.match(html, /fecha válida/);
});
test('WhatsApp render: nombre y políticas no se convierten en HTML ejecutable', () => {
  const html = renderToStaticMarkup(React.createElement(FormularioWhatsApp, { fecha, nombre: '<script>prueba</script>', telefono: '6681234567' }));
  assert.match(html, /%3Cscript%3E/);
  assert.doesNotMatch(html, /<script>/);
});
test('WhatsApp integración: abrir enlaces no marca enviado y el registro requiere confirmación humana', () => {
  const tarjeta = fs.readFileSync(new URL('../src/app/(app)/agenda/CitaCard.tsx', import.meta.url), 'utf8');
  const editor = fs.readFileSync(new URL('../src/app/(app)/agenda/RecordatorioWhatsApp.tsx', import.meta.url), 'utf8');
  assert.match(tarjeta, /window\.confirm\([\s\S]*?marcarRecordatorio\(cita.id\)/);
  assert.doesNotMatch(editor, /marcarRecordatorio|cambiarEstadoCita|localStorage|sessionStorage/);
  assert.doesNotMatch(tarjeta, /href=\{waLink\}/);
});
