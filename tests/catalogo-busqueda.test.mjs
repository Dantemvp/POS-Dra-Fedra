import test from 'node:test';
import assert from 'node:assert/strict';
import { indexarCatalogo, buscarCatalogo } from '../src/lib/catalogo-busqueda.ts';

test('busca sin distinguir acentos; no muestra catálogo completo con consulta vacía', () => {
  const p = { id: 'p1', nombre: 'Ácido Hialurónico', codigo_barras: '7501' };
  const indice = indexarCatalogo([p]);
  assert.deepEqual(buscarCatalogo(indice, ''), []);
  assert.deepEqual(buscarCatalogo(indice, '   '), []);
  assert.deepEqual(buscarCatalogo(indice, ' HIALURONICO '), [p]);
  assert.equal(indice.codigos.get('7501'), p);
});
test('conserva orden y primera coincidencia de código, sin mezclar existencias', () => {
  const productos = [{ id: 'a', nombre: 'Producto', codigo_barras: '7501' }, { id: 'b', nombre: 'Producto B', codigo_barras: '7501' }];
  const indice = indexarCatalogo(productos);
  assert.equal(indice.codigos.get('7501'), productos[0]);
  assert.equal(indice.ids.get('b'), productos[1]);
  assert.deepEqual(buscarCatalogo(indice, 'producto'), productos);
});
test('catálogo grande devuelve solo seis; las búsquedas no vuelven a normalizarlo', () => {
  let lecturas = 0;
  const productos = Array.from({ length: 2000 }, (_, i) => ({ id: `p${i}`, get nombre() { lecturas++; return `Producto ${i}`; }, codigo_barras: String(i) }));
  const indice = indexarCatalogo(productos);
  const iniciales = lecturas;
  for (let i = 0; i < 100; i++) assert.equal(buscarCatalogo(indice, 'producto').length, 6);
  assert.equal(lecturas, iniciales);
  assert.equal(indice.codigos.get('1999'), productos[1999]);
});
