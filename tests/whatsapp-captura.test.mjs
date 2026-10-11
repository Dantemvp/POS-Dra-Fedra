import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as mensajes from '../src/lib/agenda-whatsapp.ts';

function formulario(props) {
  const estados = [];
  let cursor = 0;
  const react = {
    useId: () => 'prueba',
    useState(inicial) {
      const i = cursor++;
      if (!(i in estados)) estados[i] = inicial;
      return [estados[i], valor => { estados[i] = valor; }];
    },
    createElement: (tipo, atributos, ...hijos) => ({ tipo, atributos: atributos ?? {}, hijos }),
  };
  const fuente = fs.readFileSync(new URL('../src/app/(app)/agenda/RecordatorioWhatsApp.tsx', import.meta.url), 'utf8');
  const codigo = ts.transpileModule(fuente, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 } }).outputText;
  const modulo = { exports: {} };
  vm.runInNewContext(codigo, { exports: modulo.exports, React: react, require: nombre => {
    if (nombre === 'react') return react;
    if (nombre === '@/lib/agenda-whatsapp') return mensajes;
    throw new Error(nombre);
  } });
  return () => {
    cursor = 0;
    const raiz = modulo.exports.FormularioWhatsApp(props);
    const nodos = [];
    function visitar(nodo) {
      if (Array.isArray(nodo)) return nodo.forEach(visitar);
      if (!nodo || typeof nodo !== 'object') return;
      nodos.push(nodo);
      nodo.hijos.forEach(visitar);
    }
    visitar(raiz);
    return nodos;
  };
}

for (const numero of ['6681234567', '+52 668 123 4567', '+1 202 555 0123']) {
  test(`captura completa mantiene el campo visible: ${numero}`, () => {
    const render = formulario({ fecha: '2026-10-12T10:00:00-07:00', google: true });
    let nodos = render();
    for (let i = 1; i <= numero.length; i++) {
      const campo = nodos.find(n => n.tipo === 'input');
      assert.ok(campo, 'El campo no debe desaparecer durante la captura');
      campo.atributos.onChange({ target: { value: numero.slice(0, i) } });
      nodos = render();
      assert.ok(nodos.find(n => n.tipo === 'input'));
    }
    const enlace = nodos.find(n => n.tipo === 'a');
    assert.equal(new URL(enlace.atributos.href).pathname.slice(1), mensajes.numeroWhatsApp(numero));
    const destino = nodos.find(n => n.tipo === 'span' && n.hijos[0] === 'Destino: +');
    assert.equal(destino.hijos[1], mensajes.numeroWhatsApp(numero));
  });
}

test('teléfono guardado muestra destino; Cambiar número conserva el campo al editar', () => {
  const render = formulario({ fecha: '2026-10-12T10:00:00-07:00', telefono: '6681234567', nombre: 'Persona ficticia' });
  let nodos = render();
  assert.ok(!nodos.find(n => n.tipo === 'input'));
  nodos.find(n => n.tipo === 'button' && n.hijos[0] === 'Cambiar número').atributos.onClick();
  nodos = render();
  nodos.find(n => n.tipo === 'input').atributos.onChange({ target: { value: '+52 668 123 4567' } });
  assert.ok(render().find(n => n.tipo === 'input'));
});
