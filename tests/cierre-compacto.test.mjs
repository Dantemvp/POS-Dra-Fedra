import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { cargarTS } from './helpers/modulo-ts.mjs';

// Simula los hooks, no la lógica del componente ni la acción de sus botones.
async function captura(t, respuesta, extra = {}) {
  const estados = [], refs = [], promesas = [];
  let i = 0, r = 0, llamadas = 0, enviado;
  const react = { ...React, useId: () => `captura-${i}`,
    useState(inicial) { const n = i++; if (!(n in estados)) estados[n] = inicial; return [estados[n], v => { estados[n] = v; }]; },
    useRef(inicial) { const n = r++; return refs[n] ?? (refs[n] = { current: inicial }); },
    useTransition: () => [false, f => promesas.push(f())],
  };
  const Comprobante = () => null;
  const { modulo, limpiar } = await cargarTS(new URL('../src/app/(app)/caja/CorteDelDia.tsx', import.meta.url), {
    react, './actions': { registrarCorte: async datos => { llamadas++; enviado = datos; return respuesta(datos); } },
    '@/components/CorteComprobante': Comprobante,
  });
  t.after(limpiar);
  const props = { area: 'farmacia', numVentas: 1, totalVentas: 100, totalCobros: 0, productosSalidos: 1,
    pacientesAtendidos: 0, efectivoEsperado: 100, desglose: { efectivo: 100 }, fecha: 'Ficticia', responsable: 'Ficticio', ...extra };
  const render = () => {
    i = r = 0;
    const nodos = [];
    function visitar(n) { if (!n || typeof n !== 'object') return; nodos.push(n); React.Children.toArray(n.props?.children).forEach(visitar); }
    visitar(modulo.default(props));
    return nodos;
  };
  const boton = texto => render().find(n => n.type === 'button' && n.props.children === texto);
  const contar = valor => render().find(n => n.type === 'input').props.onChange({ target: { value: valor } });
  return { render, boton, contar, finalizar: () => Promise.all(promesas), llamadas: () => llamadas,
    enviado: () => enviado, comprobante: () => render().find(n => n.type === Comprobante) };
}

test('guardar abre el ticket con la respuesta del servidor; plegar conserva el mismo comprobante', async t => {
  const corte = { id: 'FICTICIO', totalVentas: 120, totalCobros: 0, fecha: 'Ficticia', efectivoEsperado: 120, efectivoContado: 100, diferencia: -20 };
  const c = await captura(t, () => ({ ok: true, corte }));
  c.contar('100');
  const cerrar = c.boton('Guardar corte e imprimir');
  cerrar.props.onClick(); cerrar.props.onClick();
  await c.finalizar();
  assert.equal(c.llamadas(), 1);
  assert.equal(c.enviado().efectivoContado, 100);
  assert.equal(c.comprobante().props.corte, corte);
  assert.equal(c.comprobante().props.automatico, true);
  assert.equal(c.render().some(n => n.type === 'input'), false);
  assert.equal(c.boton('Ocultar ticket').props['aria-expanded'], true);
  c.boton('Ocultar ticket').props.onClick();
  assert.equal(c.boton('Ver ticket guardado').props['aria-expanded'], false);
  c.boton('Ver ticket guardado').props.onClick();
  assert.equal(c.comprobante().props.corte, corte);
  assert.equal(c.llamadas(), 1);
});

test('error explícito conserva captura y permite reintento, sin ticket automático', async t => {
  const c = await captura(t, () => ({ ok: false, error: 'Rechazado ficticio' }));
  c.contar('100'); c.boton('Guardar corte e imprimir').props.onClick(); await c.finalizar();
  assert.equal(c.render().find(n => n.type === 'input').props.value, '100');
  assert.equal(c.comprobante().props.automatico, false);
  assert.equal(c.boton('Ver vista previa del ticket').props['aria-expanded'], false);
  assert.ok(c.render().some(n => n.props?.role === 'status' && n.props.children === 'Rechazado ficticio'));
  c.boton('Guardar corte e imprimir').props.onClick(); await c.finalizar();
  assert.equal(c.llamadas(), 2);
});

test('resultado incierto deja el cierre bloqueado y el aviso visible', async t => {
  const c = await captura(t, () => { throw new Error('Fallo ficticio'); });
  c.contar('100'); c.boton('Guardar corte e imprimir').props.onClick(); await c.finalizar();
  assert.equal(c.boton('Guardar corte e imprimir').props.disabled, true);
  assert.equal(c.comprobante().props.automatico, false);
  assert.ok(c.render().some(n => typeof n.props?.children === 'string' && n.props.children.includes('No se pudo confirmar')));
  c.boton('Guardar corte e imprimir').props.onClick(); await c.finalizar();
  assert.equal(c.llamadas(), 1);
});

test('recuperar no cierra ni imprime automáticamente, y volver conserva el contado', async t => {
  const anterior = { id: 'ANTERIOR', totalVentas: 50, totalCobros: 0, fecha: 'Ficticia' };
  const c = await captura(t, () => { throw new Error('No debe cerrar'); }, { ultimoCorte: anterior });
  c.contar('105'); c.boton('Recuperar mi último corte guardado').props.onClick();
  assert.equal(c.comprobante().props.corte, anterior);
  assert.equal(c.comprobante().props.automatico, false);
  assert.equal(c.render().some(n => n.type === 'input'), false);
  c.boton('Volver al cierre del día').props.onClick();
  assert.equal(c.render().find(n => n.type === 'input').props.value, '105');
  assert.equal(c.llamadas(), 0);
});

test('contado vacío no cierra, negativo se rechaza y cero sí se envía como cero', async t => {
  const c = await captura(t, () => ({ ok: false, error: 'Ficticio' }));
  assert.equal(c.boton('Guardar corte e imprimir').props.disabled, true);
  c.boton('Guardar corte e imprimir').props.onClick();
  c.contar('-1'); c.boton('Guardar corte e imprimir').props.onClick();
  assert.equal(c.llamadas(), 0);
  c.contar('0'); c.boton('Guardar corte e imprimir').props.onClick(); await c.finalizar();
  assert.equal(c.llamadas(), 1);
  assert.equal(c.enviado().efectivoContado, 0);
});

for (const area of ['farmacia', 'consultorio']) {
  test(`cierre compacto ${area}: captura primero, detalles y ticket cerrados, sin imprimir`, async t => {
    let llamadas = 0;
    let automatico;
    const { modulo, limpiar } = await cargarTS(new URL('../src/app/(app)/caja/CorteDelDia.tsx', import.meta.url), {
      './actions': { registrarCorte: async () => { llamadas++; throw new Error('No debe llamarse'); } },
      '@/components/CorteComprobante': props => { automatico = props.automatico; return React.createElement('div', null, 'Comprobante ficticio'); },
    });
    t.after(limpiar);
    const html = renderToStaticMarkup(React.createElement(modulo.default, { area, numVentas: 1,
      totalVentas: area === 'farmacia' ? 100 : 0, totalCobros: area === 'consultorio' ? 100 : 0,
      productosSalidos: 1, pacientesAtendidos: 1, efectivoEsperado: 100, desglose: { efectivo: 100 },
      fecha: 'Ficticia', responsable: 'Ficticio' }));
    assert.match(html, /<label[^>]+for="[^"]+"[^>]*>Cuenta el efectivo<\/label>/);
    assert.match(html, /<input[^>]+value=""/);
    assert.match(html, /<button[^>]+disabled=""[^>]*>Guardar corte e imprimir/);
    assert.match(html, /aria-expanded="false"/);
    assert.match(html, /class="hidden print:block"/);
    assert.doesNotMatch(html, /<details[^>]*\bopen\b/);
    assert.ok(html.indexOf('Cuenta el efectivo') < html.indexOf('Comprobante ficticio'));
    assert.match(html, area === 'farmacia' ? /Ventas \(farmacia\)/ : /Cobros \(consultorio\)/);
    assert.doesNotMatch(html, area === 'farmacia' ? /Cobros \(consultorio\)/ : /Ventas \(farmacia\)/);
    assert.equal(automatico, false);
    assert.equal(llamadas, 0);
  });
}
