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
  assert.match(html, /Hola Persona ficticia/);
  assert.match(html, /https:\/\/wa.me\/526681234567/);
  assert.match(html, /https:\/\/web.whatsapp.com\/send/);
  assert.match(html, /Abrir el chat no envía el mensaje ni confirma la cita/);
  assert.match(html, /Políticas de reagendación \(opcional\)/);
  assert.doesNotMatch(html, /localStorage|sessionStorage/);
});
test('WhatsApp render: Google exige destinatario y no crea enlaces hasta completarlo', () => {
  const html = renderToStaticMarkup(React.createElement(FormularioWhatsApp, { fecha, google: true }));
  assert.match(html, /Confirme el nombre y teléfono/);
  assert.match(html, /Complete nombre, teléfono y mensaje/);
  assert.doesNotMatch(html, /href=/);
});
test('WhatsApp render: nombre y políticas no se convierten en HTML ejecutable', () => {
  const html = renderToStaticMarkup(React.createElement(FormularioWhatsApp, { fecha, nombre: '<script>prueba</script>', telefono: '6681234567' }));
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});
test('WhatsApp integración: abrir enlaces no marca enviado y el registro requiere confirmación humana', () => {
  const tarjeta = fs.readFileSync(new URL('../src/app/(app)/agenda/CitaCard.tsx', import.meta.url), 'utf8');
  const editor = fs.readFileSync(new URL('../src/app/(app)/agenda/RecordatorioWhatsApp.tsx', import.meta.url), 'utf8');
  assert.match(tarjeta, /window\.confirm\([\s\S]*?marcarRecordatorio\(cita.id\)/);
  assert.doesNotMatch(editor, /marcarRecordatorio|cambiarEstadoCita|localStorage|sessionStorage/);
  assert.doesNotMatch(tarjeta, /href=\{waLink\}/);
});
