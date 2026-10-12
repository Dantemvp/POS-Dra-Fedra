import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const reactUrl = pathToFileURL(require.resolve('react')).href;
let fuente = fs.readFileSync(new URL('../src/components/PanelOperativo.tsx', import.meta.url), 'utf8');
fuente = fuente.replace("import Link from 'next/link';", "const Link = ({href, children, ...props}) => React.createElement('a', {href, ...props}, children);");
fuente = fuente.replace("import { DetalleCitaAgenda } from '@/app/(app)/agenda/CalendarioAgenda';", "const DetalleCitaAgenda = ({cita}) => React.createElement('article', null, cita.nombre);");
fuente = fuente.replace("import { avisosPanel, type PanelDatos } from '@/lib/panel-operativo';", "const avisosPanel = () => [];");
for (const archivo of ['agenda-refresco', 'agenda-vista', 'google-lectura-compartida']) {
  fuente = fuente.replaceAll(`'@/lib/${archivo}'`, JSON.stringify(new URL(`../src/lib/${archivo}.ts`, import.meta.url).href));
}
fuente = `import React from ${JSON.stringify(reactUrl)};\n${fuente}\nexport { Contexto };`;
const codigo = ts.transpileModule(fuente, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText.replaceAll("from 'react'", `from ${JSON.stringify(reactUrl)}`);
const { AgendaInicio, Contexto } = await import(`data:text/javascript;base64,${Buffer.from(codigo).toString('base64')}`);

function render(citas = [], extra = {}) {
  const estado = { datos: { citas }, error: '', errorGoogle: '', cargando: false, ...extra };
  return renderToStaticMarkup(React.createElement(Contexto.Provider, { value: estado }, React.createElement(AgendaInicio)));
}

test('agenda de Inicio empieza cerrada y mantiene resumen y enlace visibles', () => {
  const html = render([{id: 'ficticia', nombre: 'Persona de prueba', fecha_hora: new Date().toISOString()}]);
  assert.match(html, /<details class="group">/);
  assert.doesNotMatch(html, /<details[^>]*\bopen(?:[=\s>])/);
  assert.match(html, /<summary[\s\S]*1 cita próxima hoy · 1 en los próximos 7 días[\s\S]*<\/summary>/);
  assert.match(html, /Ver citas/);
  assert.match(html, /Ocultar citas/);
  assert.match(html, /<a href="\/agenda"[^>]*>Ver agenda completa<\/a>[\s\S]*<details/);
});

test('agenda de Inicio conserva las tarjetas dentro del desplegable, sin desmontar borradores', () => {
  const html = render([{id: 'ficticia', nombre: 'Persona de prueba', fecha_hora: new Date().toISOString()}]);
  assert.match(html, /<\/summary>[\s\S]*<article>Persona de prueba<\/article>[\s\S]*<\/details>/);
});

test('los errores de actualización permanecen fuera del desplegable cerrado', () => {
  const html = render([], {errorGoogle: 'Google pendiente de actualizar.'});
  assert.match(html, /<p role="alert"[^>]*>Google pendiente de actualizar\.<\/p>[\s\S]*<details/);
  assert.doesNotMatch(html, /Sin citas próximas/);
});

test('el estado vacío y el límite de ocho citas siguen disponibles al abrir', () => {
  assert.match(render(), /<details[\s\S]*Sin citas próximas en esta ventana\.[\s\S]*<\/details>/);
  const citas = Array.from({length: 9}, (_, n) => ({id: String(n), nombre: `Prueba ${n}`, fecha_hora: new Date().toISOString()}));
  const html = render(citas);
  assert.equal((html.match(/<article>/g) ?? []).length, 8);
  assert.match(html, /9 en los próximos 7 días/);
  assert.match(html, /Mostrando las primeras 8 citas/);
});

test('el resumen de carga sigue visible sin abrir las tarjetas', () => {
  assert.match(render([], {datos: null, cargando: true}), /<summary[\s\S]*Consultando las citas… · Google y POS[\s\S]*<\/summary>/);
});
