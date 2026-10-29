import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { cargarTS } from './helpers/modulo-ts.mjs';

test('ventana ofrece volver, total y confirmación explícita; no tiene formulario autoenviable', async t => {
  const { modulo, limpiar } = await cargarTS(new URL('../src/components/VentanaCobro.tsx', import.meta.url)); t.after(limpiar);
  const html = renderToStaticMarkup(React.createElement(modulo.default, { area: 'Farmacia', total: 487.5,
    resumen: '1 artículo ficticio', ocupada: true, onVolver() {}, onConfirmar() {} }));
  assert.match(html, /<dialog[^>]+aria-labelledby=/);
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /Volver sin cobrar/);
  assert.match(html, /Registrando el pago/);
  assert.match(html, /<button[^>]*disabled=""/);
  assert.doesNotMatch(html, /<form|type="submit"|<dialog[^>]+\bopen=/);
});
test('métodos grandes muestran selección por texto y estado, no solo por color', async t => {
  const { modulo, limpiar } = await cargarTS(new URL('../src/components/OpcionesPago.tsx', import.meta.url)); t.after(limpiar);
  const html = renderToStaticMarkup(React.createElement(modulo.default, { total: 650, datos: { metodo: 'tarjeta', dividir: false, metodo2: 'efectivo', monto1: '' }, onChange() {} }));
  assert.equal((html.match(/class="fedra-payment-method"/g) ?? []).length, 4);
  assert.match(html, /aria-pressed="true"[^>]*>Tarjeta/);
  assert.match(html, /Combinar dos métodos/);
  assert.doesNotMatch(html, /<select/);
});
test('selector de paciente admite teclado, Escape y búsqueda sin acentos', async t => {
  let cursor = 0; const estados = [], elegidas = [];
  const react = { ...React, useId: () => 'lista-ficticia', useMemo: f => f(), useRef: () => ({ current: null }),
    useState(inicial) { const i = cursor++; if (!(i in estados)) estados[i] = inicial; return [estados[i], v => { estados[i] = typeof v === 'function' ? v(estados[i]) : v; }]; } };
  const { modulo, limpiar } = await cargarTS(new URL('../src/components/ComboBuscador.tsx', import.meta.url), { react }); t.after(limpiar);
  function render() {
    cursor = 0; const nodos = [];
    const visitar = n => { if (!n || typeof n !== 'object') return; nodos.push(n); React.Children.toArray(n.props?.children).forEach(visitar); };
    visitar(modulo.default({ value: '', opciones: [{ value: 'a', label: 'Persona de demostración' }, { value: 'b', label: 'Otra demostración' }], onChange: v => elegidas.push(v) })); return nodos;
  }
  const input = () => render().find(n => n.type === 'input');
  input().props.onChange({ target: { value: 'demostracion' } });
  assert.equal(render().filter(n => n.props?.role === 'option').length, 2);
  input().props.onKeyDown({ key: 'ArrowDown', preventDefault() {} });
  assert.equal(input().props['aria-activedescendant'], 'lista-ficticia-1');
  input().props.onKeyDown({ key: 'Enter', preventDefault() {} });
  assert.deepEqual(elegidas, ['b']); assert.equal(input().props['aria-expanded'], false);
  input().props.onFocus(); input().props.onKeyDown({ key: 'Escape', preventDefault() {} });
  assert.equal(input().props['aria-expanded'], false);
});
