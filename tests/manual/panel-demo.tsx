import React from 'react';
import { createRoot } from 'react-dom/client';
import { PanelOperativoProvider, CampanaNotificaciones, AgendaInicio } from '../../src/components/PanelOperativo';
import CorteComprobante from '../../src/components/CorteComprobante';
const corte = { id: 'CORTE-FICTICIO-001', fecha: '11/10/2026', responsable: 'Responsable ficticio', apertura: '2026-10-11T07:00:00Z', cierre: '2026-10-12T01:30:00Z', totalVentas: 1000, totalCobros: 500, efectivoEsperado: 900, efectivoContado: 850, diferencia: -50, productos: 3, pacientes: 2, desglose: { efectivo: 900, tarjeta: 400, transferencia: 200 } };
// Bloquea spool/diálogos físicos en esta demostración aislada.
window.print = () => { throw new Error('Esta demostración no imprime en hardware. Usa la captura PDF de DevTools.'); };
createRoot(document.getElementById('root')!).render(<PanelOperativoProvider rol="admin" sesion="ficticia">
  <header className="print:hidden flex items-center justify-between bg-white p-3 text-zinc-900"><span>Fedra · Prueba ficticia</span><div className="flex items-center"><CampanaNotificaciones /><button className="min-h-11 px-3" onClick={() => document.documentElement.classList.toggle('dark')}>Tema</button></div></header>
  <main className="mx-auto max-w-4xl space-y-5 p-4"><p className="corte-screen text-sm text-zinc-600">Datos inventados. No conectado a Supabase. No registra cierres ni envía mensajes.</p>
    <label className="corte-screen block text-sm text-zinc-900">Método de pago (prueba visual)<select className="mt-2 block min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-zinc-900"><option>Efectivo</option><option>Tarjeta</option><option>Transferencia</option><option>Otro</option></select></label>
    <div className="corte-screen"><AgendaInicio /></div><CorteComprobante corte={corte} /></main>
</PanelOperativoProvider>);
