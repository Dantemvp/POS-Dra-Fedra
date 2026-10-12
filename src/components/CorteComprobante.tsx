'use client';

import AutoPrint from './AutoPrint';
import { csvCorte, etiquetaAreaCorte, METODOS_CORTE, type ComprobanteCorte } from '@/lib/corte-resumen';
import { fechaSinaloa, horaSinaloa } from '@/lib/tz';

const dinero = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
export default function CorteComprobante({ corte, automatico = false }: { corte: ComprobanteCorte; automatico?: boolean }) {
  async function imprimir() {
    await document.fonts.ready;
    await Promise.all([...document.querySelectorAll<HTMLImageElement>('.ticket-corte img')].map(i => i.decode().catch(() => undefined)));
    window.print();
  }
  function exportar() {
    const url = URL.createObjectURL(new Blob([csvCorte(corte)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `corte-${corte.id ?? 'previo'}.csv`; a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const dato = (etiqueta: string, valor: string) => <div className="flex justify-between gap-3"><span>{etiqueta}</span><strong className="shrink-0 tabular-nums">{valor}</strong></div>;
  const farmacia = corte.area === 'farmacia' || (corte.farmaciaIncluida !== false && corte.consultorioIncluido === false);
  return <section aria-label="Comprobante de corte">
    <style>{`@media print {
      @page { size: auto; margin: 0; }
      html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
      main { padding: 0 !important; }
      .fedra-shell, .fedra-shell > div { min-height: 0 !important; }
      .fedra-shell { display: block !important; }
      .corte-screen { display: none !important; }
      .print-area.ticket-corte { width: 72mm; max-width: 72mm; margin: 0 auto !important; padding: 2mm !important; font: 700 12px Arial, sans-serif; background: #fff !important; box-shadow: none !important; border: 0 !important; }
      .ticket-corte, .ticket-corte * { color: #000 !important; opacity: 1 !important; text-shadow: none !important; border-color: #000 !important; }
    }`}</style>
    <div className="mb-3 flex flex-wrap gap-2 print:hidden">
      <button type="button" onClick={() => void imprimir()} className="min-h-11 rounded-lg bg-[#3f5148] px-4 py-2 font-semibold text-[#ffffff]">{corte.id ? 'Reimprimir corte / PDF' : 'Imprimir vista previa / PDF'}</button>
      <button type="button" onClick={exportar} className="min-h-11 rounded-lg border border-zinc-300 bg-white px-4 py-2 font-semibold text-zinc-800">Exportar resumen CSV</button>
    </div>
    {automatico && corte.id && <AutoPrint />}
    <div className="print-area ticket-print ticket-thermal-strong ticket-corte doc-imprimible mx-auto max-w-sm rounded-xl bg-white p-5 text-sm text-zinc-900 ring-1 ring-zinc-200">
      {/* Archivo local, sin datos clínicos ni imágenes externas. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={farmacia ? '/logo-farmacia.png' : '/logo.png'} alt={farmacia ? 'Aldama Farmacéutica' : 'Dra. Fedra Aldama'} className="ticket-logo mx-auto mb-3 h-auto w-44" />
      <h2 className="text-center text-base font-bold">{corte.id ? 'CORTE DE CAJA' : 'VISTA PREVIA, SIN GUARDAR'}</h2>
      <p className="text-center font-bold">{etiquetaAreaCorte(corte)}</p>
      <p className="my-2 text-center font-semibold">{corte.fecha}</p>
      {corte.id && <p className="break-all text-xs">Folio: {corte.id}</p>}
      <p className="break-words">Responsable: {corte.responsable}</p>
      {corte.cierre && <p className="text-xs">{corte.apertura ? `Desde ${fechaSinaloa(corte.apertura)} ${horaSinaloa(corte.apertura)}. ` : ''}Cierre: {horaSinaloa(corte.cierre)} (Sinaloa)</p>}
      <div className="my-3 space-y-1 border-y border-dashed py-3">
        {corte.farmaciaIncluida === false ? <p className="font-bold">Farmacia: no incluida en este corte.</p> : dato('Farmacia', dinero(corte.totalVentas))}
        {corte.consultorioIncluido === false ? <p className="font-bold">Consultorio: no incluido en este corte.</p> : dato('Consultorio', dinero(corte.totalCobros))}
        <div className="pt-2 text-base">{dato('Total registrado', dinero(corte.totalVentas + corte.totalCobros))}</div>
      </div>
      <h3 className="mb-2 font-bold">Por método de pago</h3>
      <div className="space-y-1">{Object.entries(corte.desglose).map(([m, n]) => <div key={m}>{dato(METODOS_CORTE[m] ?? m, dinero(n))}</div>)}</div>
      {!Object.keys(corte.desglose).length && <p>No se guardó desglose por método.</p>}
      <div className="my-3 space-y-1 border-y border-dashed py-3">
        {dato('Efectivo esperado', dinero(corte.efectivoEsperado))}
        {dato('Efectivo contado', corte.efectivoContado === null ? 'Sin capturar' : dinero(corte.efectivoContado))}
        {dato(corte.diferencia === null ? 'Diferencia' : corte.diferencia === 0 ? 'Caja cuadrada' : corte.diferencia > 0 ? 'Sobrante' : 'Faltante', corte.diferencia === null ? 'Sin determinar' : dinero(Math.abs(corte.diferencia)))}
      </div>
      {corte.farmaciaIncluida !== false && corte.numVentas !== undefined && dato('Ventas', String(corte.numVentas))}
      {corte.farmaciaIncluida !== false && dato('Productos salidos', corte.productos === null ? 'No registrado' : String(corte.productos))}
      {corte.consultorioIncluido !== false && dato('Pacientes atendidos', corte.pacientes === null ? 'No registrado' : String(corte.pacientes))}
      {corte.consultorioIncluido === undefined && <p className="mt-3 text-xs">Este corte anterior no registró si incluía consultorio.</p>}
      <p className="mt-3 text-xs">Resumen diario de ingresos registrados. No incluye fondo inicial ni retiros de efectivo.</p>
      <p className="mt-6 border-t border-dashed pt-2 text-center">Firma de quien entrega</p>
      <p className="mt-6 border-t border-dashed pt-2 text-center">Firma de quien recibe</p>
      <p className="mt-3 text-center text-xs">Documento interno. No es comprobante de venta.</p>
    </div>
  </section>;
}
