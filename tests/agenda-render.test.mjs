import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { whatsappModuleUrl } from './helpers/whatsapp-render.mjs';

const require = createRequire(import.meta.url);
const archivo = new URL('../src/app/(app)/agenda/CalendarioAgenda.tsx', import.meta.url);
let fuente = fs.readFileSync(archivo, 'utf8').replace("import Link from 'next/link';", "const Link = ({href, children, ...props}) => React.createElement('a', {href, ...props}, children);");
fuente = fuente.replace("'./RecordatorioWhatsApp'", JSON.stringify(whatsappModuleUrl));
fuente = `import React from ${JSON.stringify(pathToFileURL(require.resolve('react')).href)};\n` + fuente.replaceAll("'@/lib/agenda-vista'", JSON.stringify(new URL('../src/lib/agenda-vista.ts', import.meta.url).href));
const codigo = ts.transpileModule(fuente, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText.replaceAll("from 'react'", `from ${JSON.stringify(pathToFileURL(require.resolve('react')).href)}`);
const { default: Calendario, DetalleCitaAgenda } = await import(`data:text/javascript;base64,${Buffer.from(codigo).toString('base64')}`);
const cita = { id: 'google:prueba', origen: 'google', nombre: 'Consulta ficticia', fecha_hora: '2026-10-11', dia_completo: true, paciente_id: null, estado: 'Solo lectura', tipo: 'google', descripcion: '<script>alert("prueba")</script>', ubicacion: 'Lugar ficticio' };
test('agenda render: calendario unificado conserva origen, día y contador', () => {
  const html = renderToStaticMarkup(React.createElement(Calendario, { citas: [cita], mes: '2026-10', onMesChange() {} }));
  assert.match(html, /Octubre/);
  assert.match(html, /Google · Solo lectura/);
  assert.match(html, /aria-label="dom 11 de oct, 1 citas"/);
  assert.match(html, /Mes anterior/);
  assert.match(html, /Mes siguiente/);
});
test('agenda render: conserva notas como texto, sin ejecutar HTML ni ligar pacientes', () => {
  const html = renderToStaticMarkup(React.createElement(DetalleCitaAgenda, { cita, mostrarFecha: true }));
  assert.match(html, /Todo el día/);
  assert.match(html, /Consulta ficticia/);
  assert.match(html, /Notas y datos de la cita/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>|\/pacientes\//);
  assert.match(html, /Preparar WhatsApp/);
});
