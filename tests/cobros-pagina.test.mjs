import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { cargarTS } from './helpers/modulo-ts.mjs';

test('Consultorio da prioridad al formulario y deja el historial cerrado, sin cambiar sus consultas', async t => {
  const lecturas = [];
  const { modulo, limpiar } = await cargarTS(new URL('../src/app/(app)/cobros/page.tsx', import.meta.url), {
    'next/link': ({ children, ...props }) => React.createElement('a', props, children),
    '@/lib/auth': { getUsuarioActual: async () => ({ rol: 'asistente' }) },
    '@/lib/supabase/server': { createClient: async () => ({ from(tabla) {
      lecturas.push(tabla);
      const cadena = { select() { return this; }, eq() { return this; }, order() { return this; }, limit() { return this; },
        then(resolve) { resolve({ data: [] }); } };
      return cadena;
    } }) },
    './NuevoCobro': () => React.createElement('div', null, 'Formulario ficticio'),
    './EliminarCobro': () => null, './CancelarCobro': () => null,
  }); t.after(limpiar);
  const html = renderToStaticMarkup(await modulo.default());
  assert.match(html, /max-w-3xl space-y-6/);
  assert.match(html, /Ver cobros recientes \(0\)/);
  assert.doesNotMatch(html, /<details[^>]*\bopen\b/);
  assert.ok(html.indexOf('Formulario ficticio') < html.indexOf('<details'));
  assert.deepEqual(lecturas.sort(), ['cobros', 'pacientes', 'productos', 'servicios']);
});
