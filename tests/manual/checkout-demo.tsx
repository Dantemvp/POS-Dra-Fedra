import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Link from 'next/link';
import POS from '../../src/app/(app)/ventas/pos';
import NuevoCobro from '../../src/app/(app)/cobros/NuevoCobro';
import ThemeToggle from '../../src/components/ThemeToggle';

window.print = () => window.dispatchEvent(new Event('checkout-impresion'));
const productos = [
  { id: 'producto-1', nombre: 'Protector solar de demostración SPF 50', precio: 487.5, stock: 3, requiere_receta: false, codigo_barras: '7501111111111' },
  { id: 'producto-2', nombre: 'Crema hidratante de demostración', precio: 326.9, stock: 2, requiere_receta: false, codigo_barras: '7502222222222' },
  { id: 'producto-3', nombre: 'Producto agotado de demostración', precio: 82, stock: 0, requiere_receta: false, codigo_barras: '7503333333333' },
];
function Demo() {
  const farmacia = new URLSearchParams(location.search).get('area') !== 'consultorio';
  const [llamadas, setLlamadas] = useState(0);
  const [impresiones, setImpresiones] = useState(0);
  const [destino, setDestino] = useState('');
  useEffect(() => {
    const cobro = (e: Event) => setLlamadas((e as CustomEvent).detail.llamadas);
    const impresion = () => setImpresiones(n => n + 1);
    const ruta = (e: Event) => setDestino((e as CustomEvent<string>).detail);
    window.addEventListener('checkout-llamada', cobro); window.addEventListener('checkout-impresion', impresion); window.addEventListener('demo-route', ruta);
    return () => { window.removeEventListener('checkout-llamada', cobro); window.removeEventListener('checkout-impresion', impresion); window.removeEventListener('demo-route', ruta); };
  }, []);
  return <div className="fedra-shell min-h-screen">
    <header className="fedra-header border-b border-zinc-200 px-5 py-4 print:hidden"><div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={farmacia ? '/logo-farmacia.png' : '/logo.png'} alt={farmacia ? 'Aldama Farmacéutica' : 'Dra. Fedra Aldama'} className={`h-12 w-40 object-contain ${farmacia ? '' : 'fedra-brand-logo'}`} />
      <nav className="flex items-center gap-3 text-sm"><Link href="/?area=farmacia" className="font-semibold underline">Farmacia</Link><Link href="/?area=consultorio" className="font-semibold underline">Consultorio</Link><ThemeToggle /></nav>
    </div></header>
    <main className="relative mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
      <div className="print:hidden"><p className="text-sm font-medium text-zinc-600">{farmacia ? 'Farmacia' : 'Consultorio'} · Demostración local, sin cobros reales</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">{farmacia ? 'Punto de venta' : 'Cobros de Consultorio'}</h1>
        <p className="mt-2 text-sm text-zinc-600">{farmacia ? 'Agrega los productos y revisa el pago al terminar.' : 'Elige al paciente, agrega los servicios y continúa al pago.'}</p>
        <p role="status" className="mt-2 text-xs text-zinc-600">Cobros simulados: {llamadas}. Impresiones simuladas: {impresiones}.{destino && ` Destino simulado: ${destino}`}</p>
      </div>
      {farmacia ? <POS productos={productos} vendedor="Equipo de demostración" /> : <NuevoCobro pacientes={[{ id: 'paciente-demo', nombre: 'Paciente de demostración' }]} servicios={[{ id: 'servicio-demo', nombre: 'Consulta de seguimiento de demostración', precio: 650 }]} productos={productos} />}
    </main>
  </div>;
}
createRoot(document.getElementById('root')!).render(<Demo />);
