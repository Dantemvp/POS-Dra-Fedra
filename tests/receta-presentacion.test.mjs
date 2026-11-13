import test from 'node:test';
import assert from 'node:assert/strict';
import { nombreParaReceta, productosParaReceta } from '../src/lib/receta-presentacion.ts';

test('abrevia envase conservando marca, sustancia, concentración y forma', () => {
  assert.equal(nombreParaReceta('Acxion C Fentermina 30 mg cápsulas (30)'), 'Acxion C (Fentermina 30 mg cápsulas)');
  assert.equal(nombreParaReceta('Ejemplo 50 mg caja con 30 tabletas'), 'Ejemplo 50 mg tabletas');
  assert.equal(nombreParaReceta('Ejemplo 50 mg de 30 tabletas'), 'Ejemplo 50 mg tabletas');
  assert.equal(nombreParaReceta('Ejemplo 50 mg c/30 tabletas'), 'Ejemplo 50 mg tabletas');
});

test('no cambia concentraciones, duraciones, inyectables ni agrega sustancias', () => {
  for (const nombre of ['Acxion 30 mg', 'Ejemplo 30 mg/5 ml', 'Ejemplo 2.5 mg (1) (28 días)', 'Ejemplo (liberación prolongada) 30 mg', 'Ejemplo 0.5 mg por 30 días', 'Ejemplo tomar 2 tabletas']) {
    assert.equal(nombreParaReceta(nombre), nombre);
  }
});

test('conserva ID del inventario y distingue envases con el mismo nombre abreviado', () => {
  const productos = [{ id: 'a', nombre: 'Ejemplo 20 mg caja con 30 tabletas' }, { id: 'b', nombre: 'Ejemplo 20 mg caja con 60 tabletas' }, { id: 'c', nombre: 'Otro 50 mg de 30 cápsulas' }];
  assert.deepEqual(productosParaReceta(productos), [productos[0], productos[1], { id: 'c', nombre: 'Otro 50 mg cápsulas' }]);
  assert.equal(productos[2].nombre, 'Otro 50 mg de 30 cápsulas');
});
