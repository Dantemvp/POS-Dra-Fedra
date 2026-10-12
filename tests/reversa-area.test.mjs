import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { leerDesgloseCorte, csvCorte } from '../src/lib/corte-resumen.ts';
import { cargarTS } from './helpers/modulo-ts.mjs';

test('reversa: snapshots nuevos conservan área y no imprimen ni exportan metadatos como pagos', async t => {
  const { modulo, limpiar } = await cargarTS(new URL('../src/components/CorteComprobante.tsx', import.meta.url), { './AutoPrint': () => null });
  t.after(limpiar);
  for (const [codigo, area] of [[1, 'farmacia'], [2, 'consultorio']]) {
    const alcance = leerDesgloseCorte({ __area_corte: codigo, __solo_farmacia: codigo === 1 ? 1 : 0, efectivo: 100 });
    const corte = { id: 'ficticio', fecha: '12/10/2026', responsable: 'Ficticio', totalVentas: codigo === 1 ? 100 : 0, totalCobros: codigo === 2 ? 100 : 0, efectivoEsperado: 100, efectivoContado: 100, diferencia: 0, productos: codigo === 1 ? 1 : 0, pacientes: codigo === 2 ? 1 : 0, ...alcance };
    assert.equal(alcance.area, area);
    assert.deepEqual(alcance.desglose, { efectivo: 100 });
    const html = renderToStaticMarkup(React.createElement(modulo.default, { corte }));
    assert.doesNotMatch(html, /__area_corte|__solo_farmacia/);
    const csv = csvCorte(corte);
    assert.doesNotMatch(csv, /__area_corte|__solo_farmacia/);
    assert.match(csv, /"Total","100.00"/);
    if (area === 'consultorio') {
      assert.match(html, /Farmacia: no incluida en este corte/);
      assert.doesNotMatch(html, /Productos salidos/);
      assert.match(csv, /"Farmacia","No incluida en este corte"/);
    } else assert.match(html, /Consultorio: no incluido en este corte/);
  }
});

test('reversa: no recupera un corte clínico como último corte de la caja anterior', async t => {
  let codigo = 2;
  const db = { auth: { getUser: async () => ({ data: { user: { id: 'sesion-ficticia' } } }) }, from(tabla) {
    const result = () => tabla === 'usuarios' ? { data: { id: 'ficticio' } } : { data: { id: 'corte-ficticio', cierre: '2026-10-12T18:00:00Z', total_ventas: codigo === 1 ? 100 : 0, total_cobros: codigo === 2 ? 100 : 0, desglose: { __area_corte: codigo, efectivo: 100 } }, error: null };
    const q = { select() { return q; }, eq() { return q; }, not() { return q; }, order() { return q; }, limit() { return q; }, single: async () => result(), maybeSingle: async () => result() };
    return q;
  } };
  const { modulo, limpiar } = await cargarTS(new URL('../src/lib/caja-lectura.ts', import.meta.url), { '@/lib/supabase/server': { createClient: async () => db } });
  t.after(limpiar);
  assert.equal(await modulo.leerUltimoCortePropio('Ficticio'), null);
  codigo = 1;
  const farmacia = await modulo.leerUltimoCortePropio('Ficticio');
  assert.equal(farmacia.area, 'farmacia');
  assert.deepEqual(farmacia.desglose, { efectivo: 100 });
});

test('reversa: corte clínico en detalle no consulta ni representa ventas de Farmacia', async t => {
  const tablas = [];
  const db = { from(tabla) {
    tablas.push(tabla);
    const result = () => tabla === 'cortes_caja' ? { data: { apertura: '2026-10-12T07:00:00Z', cierre: '2026-10-12T18:00:00Z', total_ventas: 0, total_cobros: 100, desglose: { __area_corte: 2, efectivo: 100 }, usuarios: { nombre: 'Ficticio' } } } : { data: [] };
    const q = { select() { return q; }, eq() { return q; }, gte() { return q; }, lte() { return q; }, order() { return q; }, single: async () => result(), then(resolve) { return Promise.resolve(result()).then(resolve); } };
    return q;
  } };
  const { modulo, limpiar } = await cargarTS(new URL('../src/app/(app)/cortes/[id]/page.tsx', import.meta.url), {
    'next/link': ({ children, ...props }) => React.createElement('a', props, children),
    'next/navigation': { notFound() { throw new Error('No encontrado'); } },
    '@/lib/supabase/server': { createClient: async () => db },
    '@/components/CorteComprobante': ({ corte }) => React.createElement('p', null, corte.area),
  });
  t.after(limpiar);
  const html = renderToStaticMarkup(await modulo.default({ params: Promise.resolve({ id: 'ficticio' }) }));
  assert.ok(!tablas.includes('ventas'));
  assert.match(html, /consultorio/);
  assert.doesNotMatch(html, /Ventas de farmacia \(/);
});
