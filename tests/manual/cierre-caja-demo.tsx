import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import CorteDelDia from '../../src/app/(app)/caja/CorteDelDia';
import ThemeToggle from '../../src/components/ThemeToggle';
import type { AreaCorte } from '../../src/lib/corte-resumen';

// Nunca manda una impresión al sistema operativo ni llama a Supabase.
window.print = () => window.dispatchEvent(new Event('impresion-demo'));
function Demo() {
  const parametros = new URLSearchParams(location.search);
  const area: AreaCorte = parametros.get('area') === 'consultorio' ? 'consultorio' : 'farmacia';
  const farmacia = area === 'farmacia';
  const [llamadas, setLlamadas] = useState(0);
  const [impresiones, setImpresiones] = useState(0);
  useEffect(() => {
    const cierre = (evento: Event) => setLlamadas((evento as CustomEvent<number>).detail);
    const impresion = () => setImpresiones(n => n + 1);
    window.addEventListener('cierre-demo', cierre);
    window.addEventListener('impresion-demo', impresion);
    return () => { window.removeEventListener('cierre-demo', cierre); window.removeEventListener('impresion-demo', impresion); };
  }, []);
  const datos = { area, numVentas: farmacia ? 2 : 0, totalVentas: farmacia ? 1000 : 0,
    totalCobros: farmacia ? 0 : 500, productosSalidos: farmacia ? 3 : 0,
    pacientesAtendidos: farmacia ? 0 : 2, efectivoEsperado: farmacia ? 600 : 200,
    desglose: farmacia ? { efectivo: 600, tarjeta: 400 } : { efectivo: 200, tarjeta: 300 },
    fecha: '12/10/2026', responsable: 'Responsable ficticio' };
  return <main className="mx-auto max-w-3xl space-y-4 p-4">
    <header className="corte-screen space-y-2 text-zinc-900">
      <div className="flex items-center justify-between gap-3"><h1 className="text-xl font-semibold">Prueba aislada de cierre</h1><ThemeToggle /></div>
      <p>Datos inventados. Sin conexión a la base ni impresión física.</p>
      <p role="status">Cierres simulados: {llamadas}. Impresiones simuladas: {impresiones}.</p>
    </header>
    <CorteDelDia {...datos} puedeCerrar={parametros.get('consulta') !== 'si'} ultimoCorte={{ ...datos,
      id: 'CORTE-FICTICIO-ANTERIOR', efectivoContado: farmacia ? 600 : 200, diferencia: 0,
      productos: datos.productosSalidos, pacientes: datos.pacientesAtendidos,
      farmaciaIncluida: farmacia, consultorioIncluido: !farmacia }} />
  </main>;
}
createRoot(document.getElementById('root')!).render(<Demo />);
