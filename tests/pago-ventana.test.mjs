import test from 'node:test';
import assert from 'node:assert/strict';
import { prepararPago, revisarRecibido } from '../src/lib/pago-ventana.ts';

const datos = { metodo: 'efectivo', dividir: false, metodo2: 'tarjeta', monto1: '' };
test('pago simple conserva el contrato existente y admite un concepto gratuito', () => {
  assert.deepEqual(prepararPago(487.5, datos), { pagos: undefined, efectivo: 487.5 });
  assert.deepEqual(prepararPago(0, { ...datos, metodo: 'transferencia' }), { pagos: undefined, efectivo: 0 });
});
test('400 pagos mixtos suman exactamente el total en centavos', () => {
  for (let i = 1; i <= 400; i++) {
    const total = (12345 + i * 137) / 100;
    const primero = (i * 17 % 12344 + 1) / 100;
    const p = prepararPago(total, { ...datos, dividir: true, monto1: String(primero) });
    assert.equal(p.error, undefined);
    assert.equal(p.pagos.reduce((s, v) => s + Math.round(v.monto * 100), 0), Math.round(total * 100));
    assert.equal(p.efectivo, primero);
  }
});
for (const monto1 of ['', '-1', '0', '487.5', '600', '1.001', 'NaN', 'Infinity']) {
  test(`mixto rechaza primer monto inválido: ${monto1 || 'vacío'}`, () => {
    assert.ok(prepararPago(487.5, { ...datos, dividir: true, monto1 }).error);
  });
}
test('mixto rechaza métodos repetidos y detecta efectivo como segundo pago', () => {
  assert.ok(prepararPago(100, { ...datos, dividir: true, monto1: '30', metodo2: 'efectivo' }).error);
  const p = prepararPago(487.5, { metodo: 'tarjeta', dividir: true, metodo2: 'efectivo', monto1: '200' });
  assert.equal(p.efectivo, 287.5);
});
test('efectivo recibido calcula cambio y no permite faltante ni números inválidos', () => {
  assert.deepEqual(revisarRecibido('500', 487.5), { recibido: 500, cambio: 12.5 });
  assert.deepEqual(revisarRecibido('', 487.5), {});
  assert.deepEqual(revisarRecibido('500', 0), {});
  for (const valor of ['0', '480', '-1', 'NaN', 'Infinity', '487.501']) assert.ok(revisarRecibido(valor, 487.5).error);
});
