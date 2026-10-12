import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as nav from '../src/components/nav.ts';
import { cargarTS } from './helpers/modulo-ts.mjs';

async function fixture(pathname, search = '') {
  const navigation = { usePathname: () => pathname, useSearchParams: () => new URLSearchParams(search) };
  const identidad = await cargarTS(new URL('../src/components/AreaIdentity.tsx', import.meta.url), {
    'next/navigation': navigation,
    'next/image': ({ priority, ...props }) => { void priority; return React.createElement('img', props); },
    '@/components/nav': nav,
  });
  const menu = await cargarTS(new URL('../src/components/AreaNavigation.tsx', import.meta.url), {
    'next/navigation': navigation,
    'next/link': ({ children, ...props }) => React.createElement('a', props, children),
    '@/components/nav': nav,
    '@/components/AreaIdentity': identidad.modulo,
  });
  return { ...identidad.modulo, Menu: menu.modulo.default, limpiar() { identidad.limpiar(); menu.limpiar(); } };
}

test('identidad: la ruta del área manda sobre una selección antigua y respeta las áreas del rol', () => {
  assert.equal(nav.areaParaVista('admin', '/inventario', 'consultorio'), 'farmacia');
  assert.equal(nav.areaParaVista('admin', '/cobros/corte', 'farmacia'), 'consultorio');
  assert.equal(nav.areaParaVista('admin', '/recetas/ejemplo', 'farmacia'), 'consultorio');
  assert.equal(nav.areaParaVista('farmacia', '/dashboard', 'consultorio'), 'farmacia');
  assert.equal(nav.areaParaVista('doctora', '/dashboard', 'farmacia'), 'consultorio');
  assert.equal(nav.areaParaVista('admin', '/dashboard', 'invalida'), 'consultorio');
});

test('identidad: vistas compartidas conservan la selección explícita', () => {
  for (const ruta of ['/dashboard', '/notificaciones', '/cortes', '/cortes/resumen']) {
    assert.equal(nav.areaParaVista('admin', ruta, 'farmacia'), 'farmacia');
    assert.equal(nav.areaParaVista('admin', ruta, 'consultorio'), 'consultorio');
  }
});

for (const [ruta, area, alt, src] of [
  ['/caja', 'farmacia', 'Aldama Farmacéutica', '/logo-farmacia.png'],
  ['/cobros/corte', 'consultorio', 'Dra. Fedra Aldama', '/logo.png'],
]) {
  test(`identidad ${area}: logo, indicador independiente del menú y selección textual`, async () => {
    const f = await fixture(ruta);
    try {
      const logo = renderToStaticMarkup(React.createElement(f.AreaBrand, { rol: 'admin', compact: true }));
      assert.ok(logo.includes(`src="${src}"`));
      assert.ok(logo.includes(`alt="${alt}"`));
      if (area === 'farmacia') assert.doesNotMatch(logo, /fedra-brand-logo/);
      const indicador = renderToStaticMarkup(React.createElement(f.AreaIndicator, { rol: 'admin' }));
      assert.ok(indicador.includes(`data-area="${area}"`));
      assert.match(indicador, /Área activa/);
      const menu = renderToStaticMarkup(React.createElement(f.Menu, { rol: 'admin' }));
      assert.match(menu, /✓ Activa/);
      assert.match(menu, /Cambiar área/);
      assert.ok(menu.includes(`href="/dashboard?area=${area}"`));
      assert.ok(menu.includes(`href="/notificaciones?area=${area}"`));
      assert.ok(menu.includes(`href="/cortes?area=${area}"`));
      assert.match(menu, /aria-current="true"/);
    } finally { f.limpiar(); }
  });
}

test('identidad: gestión compartida no se presenta como caja exclusiva del área', async () => {
  const f = await fixture('/cortes/resumen', 'area=farmacia');
  try {
    const html = renderToStaticMarkup(React.createElement(f.AreaIndicator, { rol: 'admin' }));
    assert.match(html, /Farmacia/);
    assert.match(html, /Gestión compartida/);
  } finally { f.limpiar(); }
});

test('identidad: farmacia y asistente conservan su marca sin ofrecer cambio a un área no autorizada', async () => {
  const f = await fixture('/dashboard');
  try {
    for (const [rol, marca] of [['farmacia', 'Aldama Farmacéutica'], ['asistente', 'Dra. Fedra Aldama']]) {
      const logo = renderToStaticMarkup(React.createElement(f.AreaBrand, { rol }));
      assert.ok(logo.includes(marca));
      const menu = renderToStaticMarkup(React.createElement(f.Menu, { rol }));
      assert.doesNotMatch(menu, /Cambiar área de trabajo/);
    }
  } finally { f.limpiar(); }
});
