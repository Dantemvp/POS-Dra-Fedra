import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import Sidebar from '../../src/components/Sidebar';
import MobileTopBar from '../../src/components/MobileTopBar';
import ThemeToggle from '../../src/components/ThemeToggle';
import CorteComprobante from '../../src/components/CorteComprobante';
import type { AreaCorte } from '../../src/lib/corte-resumen';

window.print = () => { throw new Error('Prueba aislada: impresión física desactivada.'); };
function Demo() {
  const [area] = useState<AreaCorte>(location.pathname.startsWith('/cobros') ? 'consultorio' : 'farmacia');
  const corte = { id: 'CORTE-FICTICIO', area, farmaciaIncluida: area === 'farmacia', consultorioIncluido: area === 'consultorio', fecha: '12/10/2026', responsable: 'Responsable ficticio', totalVentas: area === 'farmacia' ? 1000 : 0, totalCobros: area === 'consultorio' ? 500 : 0, efectivoEsperado: area === 'farmacia' ? 600 : 200, efectivoContado: area === 'farmacia' ? 600 : 200, diferencia: 0, productos: 3, pacientes: 2, desglose: area === 'farmacia' ? { efectivo: 600, tarjeta: 400 } : { efectivo: 200, tarjeta: 300 } };
  return <div className="fedra-shell flex min-h-screen"><Sidebar rol="admin" /><div className="relative z-[1] min-w-0 flex-1">
    <MobileTopBar rol="admin" nombre="Responsable ficticio" />
    <header className="fedra-header hidden items-center justify-end gap-4 border-b border-zinc-200 p-4 md:flex"><span className="text-zinc-700">Prueba ficticia, sin conexión a la base</span><ThemeToggle /></header>
    <main className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6"><div className="corte-screen">
      <h1 className="text-2xl font-semibold text-zinc-900">Caja de {area === 'farmacia' ? 'Farmacia' : 'Consultorio'}</h1>
      <p className="mt-2 text-sm text-zinc-600">Datos inventados. No registra ventas, cobros ni cierres.</p>
      <div className="mt-4 flex flex-wrap gap-3"><button type="button" className="fedra-primary min-h-11 rounded-lg px-4 font-semibold" onClick={() => { location.href = area === 'farmacia' ? '/cobros/corte' : '/caja'; }}>Cambiar área de prueba</button><button type="button" className="min-h-11 rounded-lg bg-zinc-900 px-4 font-semibold text-white">Botón principal</button><ThemeToggle /></div>
      <section className="mt-4 rounded-xl bg-white p-5 ring-1 ring-zinc-200"><h2 className="font-semibold text-zinc-900">Ingresos de esta área</h2><p className="mt-2 text-zinc-600">La otra área no se suma al corte.</p><input aria-label="Importe ficticio" className="mt-3 rounded-lg border border-zinc-300 bg-white p-3 text-zinc-900" placeholder="0.00" /></section>
    </div><CorteComprobante corte={corte} /></main>
  </div></div>;
}
createRoot(document.getElementById('root')!).render(<Demo />);
