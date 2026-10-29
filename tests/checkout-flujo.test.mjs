import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cargarTS } from './helpers/modulo-ts.mjs';

const productos = [{ id: 'p1', nombre: 'Producto ficticio', precio: 487.5, stock: 2, requiere_receta: false, codigo_barras: '7501111111111' }];
async function flujo(t, area, respuesta = async () => ({ ok: true, folio: 42, id: 'COBRO-FICTICIO' })) {
  const estados = [], refs = [], efectos = [], promesas = [], rutas = [], llamadas = [];
  let cursor = 0, refCursor = 0;
  const react = { ...React,
    useState(inicial) { const i = cursor++; if (!(i in estados)) estados[i] = inicial; return [estados[i], v => { estados[i] = typeof v === 'function' ? v(estados[i]) : v; }]; },
    useRef(inicial) { const i = refCursor++; return refs[i] ?? (refs[i] = { current: inicial }); },
    useMemo: f => f(), useEffect: f => efectos.push(f),
    useTransition: () => [false, f => promesas.push(f())],
  };
  const Barcode = () => null, Ventana = () => null, Opciones = () => null, Combo = () => null, AutoPrint = () => null;
  const action = async (...args) => { llamadas.push(args); return respuesta(...args); };
  const externos = { react, '@/components/BarcodeInput': Barcode, '@/components/VentanaCobro': Ventana,
    '@/components/OpcionesPago': Opciones, '@/components/ComboBuscador': Combo, '@/components/AutoPrint': AutoPrint,
    'qrcode.react': { QRCodeSVG: () => null }, 'next/navigation': { useRouter: () => ({ push: r => rutas.push(r), refresh() {} }) },
    './actions': { cobrar: action, crearCobro: action, cargarReceta: async () => ({ ok: true, productoIds: ['p1'] }) } };
  const archivo = area === 'farmacia' ? '../src/app/(app)/ventas/pos.tsx' : '../src/app/(app)/cobros/NuevoCobro.tsx';
  const { modulo, limpiar } = await cargarTS(new URL(archivo, import.meta.url), externos); t.after(limpiar);
  const props = area === 'farmacia' ? { productos, vendedor: 'Equipo ficticio' } : {
    productos, pacientes: [{ id: 'paciente', nombre: 'Paciente ficticio' }], servicios: [{ id: 'servicio', nombre: 'Servicio ficticio', precio: 650 }] };
  function render() {
    cursor = refCursor = 0;
    const nodos = [];
    function visitar(n) { if (!n || typeof n !== 'object') return; nodos.push(n); React.Children.toArray(n.props?.children).forEach(visitar); }
    visitar(modulo.default(props));
    return nodos;
  }
  const boton = texto => render().find(n => n.type === 'button' && typeof n.props.children === 'string' && n.props.children.includes(texto));
  const modal = () => render().find(n => n.type === Ventana);
  const opciones = () => render().find(n => n.type === Opciones);
  render();
  if (area === 'consultorio') {
    const previo = globalThis.window;
    globalThis.window = { setTimeout: f => { f(); return 0; }, clearTimeout() {} };
    try { efectos[0](); } finally { globalThis.window = previo; }
    render().find(n => n.type === Combo).props.onChange('paciente');
    boton('Agregar servicio').props.onClick();
    render().find(n => n.type === 'select').props.onChange({ target: { value: 'servicio' } });
  } else {
    render().find(n => n.type === Barcode).props.onScan('7501111111111');
  }
  return { render, boton, modal, opciones, llamadas, rutas, AutoPrint, Barcode,
    abrir: () => boton('Continuar al cobro').props.onClick({ currentTarget: { focus() {} } }),
    terminar: () => Promise.all(promesas) };
}

for (const area of ['farmacia', 'consultorio']) {
  test(`${area}: abrir y volver no cobran ni pierden la captura`, async t => {
    const f = await flujo(t, area);
    assert.equal(f.modal(), undefined);
    f.abrir(); assert.ok(f.modal()); assert.equal(f.llamadas.length, 0);
    f.opciones().props.onChange({ dividir: true, monto1: '100', metodo: 'efectivo', metodo2: 'tarjeta' });
    f.modal().props.onVolver(); assert.equal(f.modal(), undefined);
    f.abrir(); assert.equal(f.opciones().props.datos.monto1, '100'); assert.equal(f.llamadas.length, 0);
  });
  test(`${area}: doble confirmación hace una sola llamada y conserva impresión posterior`, async t => {
    const f = await flujo(t, area); f.abrir();
    const confirmar = f.modal().props.onConfirmar;
    await Promise.all([confirmar(), confirmar()]); await f.terminar();
    assert.equal(f.llamadas.length, 1);
    if (area === 'farmacia') { assert.ok(f.render().find(n => n.type === f.AutoPrint)); assert.equal(f.modal(), undefined); }
    else { assert.deepEqual(f.rutas, ['/cobros/COBRO-FICTICIO?imprimir=1']); assert.equal(f.modal().props.ocupada, true); }
  });
  test(`${area}: rechazo permite reintento sin imprimir ni salir`, async t => {
    const f = await flujo(t, area, async () => ({ ok: false, error: 'Rechazo ficticio' })); f.abrir();
    await f.modal().props.onConfirmar(); await f.terminar();
    assert.equal(f.modal().props.error, 'Rechazo ficticio'); assert.equal(f.rutas.length, 0);
    assert.equal(f.render().some(n => n.type === f.AutoPrint), false);
    await f.modal().props.onConfirmar(); await f.terminar(); assert.equal(f.llamadas.length, 2);
  });
  test(`${area}: resultado incierto bloquea otro cobro aunque se vuelva atrás`, async t => {
    const f = await flujo(t, area, async () => { throw new Error('Red ficticia'); }); f.abrir();
    await f.modal().props.onConfirmar(); await f.terminar();
    assert.equal(f.modal().props.bloqueada, true);
    await f.modal().props.onConfirmar(); await f.terminar(); assert.equal(f.llamadas.length, 1);
    f.modal().props.onVolver(); assert.equal(f.boton('Continuar al cobro').props.disabled, true);
  });
  test(`${area}: mixto conserva los dos métodos y sus importes al servidor`, async t => {
    const f = await flujo(t, area); f.abrir();
    f.opciones().props.onChange({ dividir: true, monto1: '100', metodo: 'efectivo', metodo2: 'tarjeta' });
    await f.modal().props.onConfirmar(); await f.terminar();
    const pagos = area === 'farmacia' ? f.llamadas[0][3] : f.llamadas[0][0].pagos;
    assert.deepEqual(pagos, [{ metodo: 'efectivo', monto: 100 }, { metodo: 'tarjeta', monto: area === 'farmacia' ? 387.5 : 550 }]);
  });
}
test('farmacia: recibido insuficiente no cobra; corregir permite continuar', async t => {
  const f = await flujo(t, 'farmacia'); f.abrir();
  f.opciones().props.onRecibido('400'); f.modal().props.onConfirmar(); await f.terminar();
  assert.equal(f.llamadas.length, 0); assert.match(f.modal().props.error, /no alcanza/);
  f.opciones().props.onRecibido('500'); f.modal().props.onConfirmar(); await f.terminar(); assert.equal(f.llamadas.length, 1);
});
test('farmacia: un escaneo con la ventana abierta no cambia el total', async t => {
  const f = await flujo(t, 'farmacia'); f.abrir();
  const inicial = f.modal().props.total;
  f.render().find(n => n.type === f.Barcode).props.onScan('7501111111111');
  assert.equal(f.modal().props.total, inicial);
});
