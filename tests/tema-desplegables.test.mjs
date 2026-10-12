import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');
test('las opciones y grupos de los selects usan fondo y texto del mismo tema', () => {
  const regla = css.match(/select option,\s*select optgroup\s*\{([^}]+)\}/)?.[1];
  assert.ok(regla, 'Falta la regla del popup nativo');
  assert.match(regla, /background-color:\s*var\(--background\)/);
  assert.match(regla, /color:\s*var\(--foreground\)/);
  assert.match(css, /:root\s*\{[^}]*--background:\s*#ffffff;[^}]*--foreground:\s*#171717;/);
  assert.match(css, /\.dark\s*\{[^}]*--background:\s*#141312;[^}]*--foreground:\s*#f2eeec;/);
});
