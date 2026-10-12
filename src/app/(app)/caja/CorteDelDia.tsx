"use client";

import { useId, useRef, useState, useTransition } from "react";
import { registrarCorte } from "./actions";
import CorteComprobante from '@/components/CorteComprobante';
import type { AreaCorte, ComprobanteCorte } from '@/lib/corte-resumen';

const money = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

const ETIQUETA_METODO: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  otro: "Otro",
};

export default function CorteDelDia({
  numVentas,
  totalVentas,
  totalCobros,
  productosSalidos,
  pacientesAtendidos,
  efectivoEsperado,
  desglose,
  fecha,
  responsable,
  ultimoCorte,
  area = 'farmacia',
  puedeCerrar = true,
}: {
  numVentas: number;
  totalVentas: number;
  totalCobros: number;
  productosSalidos: number;
  pacientesAtendidos: number;
  efectivoEsperado: number;
  desglose: Record<string, number>;
  fecha: string;
  responsable: string;
  ultimoCorte?: ComprobanteCorte | null;
  area?: AreaCorte;
  puedeCerrar?: boolean;
}) {
  const consultorioIncluido = area === 'consultorio';
  const [contado, setContado] = useState("");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [guardado, setGuardado] = useState<ComprobanteCorte | null>(null);
  const cerrando = useRef(false);
  const [resultadoIncierto, setResultadoIncierto] = useState(false);
  const [mostrarAnterior, setMostrarAnterior] = useState(false);
  const [verComprobante, setVerComprobante] = useState(false);
  const contadoId = useId();
  const comprobanteId = useId();

  const contadoNum = contado === "" ? null : Number(contado) || 0;
  const diferencia = contadoNum === null ? null : contadoNum - efectivoEsperado;
  const metodos = Object.entries(desglose).filter(([, v]) => v > 0);

  function cerrarCorte() {
    if (!puedeCerrar || pending || guardado || cerrando.current || mostrarAnterior) return;
    if (contadoNum === null || !Number.isFinite(contadoNum) || contadoNum < 0) { setMsg('Captura el efectivo contado antes de cerrar.'); return; }
    setMsg(null);
    cerrando.current = true;
    startTransition(async () => {
      try {
      const res = await registrarCorte({
        area,
        totalVentas,
        totalCobros,
        efectivoEsperado,
        efectivoContado: contadoNum,
        diferencia,
        totalProductos: productosSalidos,
        pacientesAtendidos,
        desglose,
      });
      setMsg(res.ok ? "Corte guardado." : (res.error ?? "Error al guardar."));
      if (res.ok && res.corte) { setGuardado(res.corte); setVerComprobante(true); }
      if (!res.ok) cerrando.current = false;
      } catch {
        // Resultado incierto: no permitir otro cierre sin revisar el historial.
        setMsg('No se pudo confirmar el cierre. Revisa el historial antes de recargar o reintentar.');
        setResultadoIncierto(true);
      }
    });
  }

  const comprobante = mostrarAnterior && ultimoCorte ? ultimoCorte : guardado ?? { fecha, responsable, totalVentas, totalCobros, efectivoEsperado,
    efectivoContado: contadoNum, diferencia, productos: productosSalidos, pacientes: pacientesAtendidos, desglose, numVentas, area, farmaciaIncluida: area === 'farmacia', consultorioIncluido };

  return <section aria-label={`Cierre de caja de ${area === 'farmacia' ? 'Farmacia' : 'Consultorio'}`}>
    <div className="corte-screen rounded-xl bg-white p-5 ring-1 ring-zinc-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-lg font-semibold text-zinc-900">Corte de {area === 'farmacia' ? 'Farmacia' : 'Consultorio'}</h2><p className="text-xs text-zinc-500">{comprobante.fecha}</p></div>
        <div className="text-right"><p className="text-xs text-zinc-500">Total del área</p><p className="font-semibold tabular-nums text-zinc-900">{money(comprobante.totalVentas + comprobante.totalCobros)}</p></div>
      </div>

      {!mostrarAnterior && !guardado && <>
        {puedeCerrar ? <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0 flex-1 basis-full sm:basis-0"><label htmlFor={contadoId} className="mb-2 block font-semibold text-zinc-900">Cuenta el efectivo</label>
              <input id={contadoId} type="number" inputMode="decimal" min="0" step="0.01" value={contado} disabled={pending || resultadoIncierto}
                onChange={e => setContado(e.target.value)} placeholder="0.00"
                className="min-h-11 w-full max-w-64 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-lg tabular-nums text-zinc-900 outline-none focus-visible:outline-2 focus-visible:outline-offset-2" />
            </div>
            <div className="text-sm text-zinc-700"><p>Efectivo esperado</p><p className="font-semibold tabular-nums">{money(efectivoEsperado)}</p></div>
          </div>
          {diferencia !== null && <div className="flex justify-between gap-3 rounded-lg bg-zinc-50 p-3 text-sm font-semibold" role="status">
            <span className="text-zinc-900">{diferencia === 0 ? 'Caja cuadrada' : diferencia > 0 ? 'Sobrante' : 'Faltante'}</span>
            <span className={`tabular-nums ${diferencia === 0 ? 'text-green-700 dark:text-green-300' : diferencia > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-red-600 dark:text-red-300'}`}>{money(Math.abs(diferencia))}</span>
          </div>}
          <button type="button" onClick={cerrarCorte} disabled={pending || resultadoIncierto || contadoNum === null}
            className="fedra-primary min-h-11 w-full rounded-lg px-4 py-2 font-semibold disabled:opacity-50 sm:w-auto">
            {pending ? 'Guardando…' : 'Guardar corte e imprimir'}
          </button>
          <p className="text-sm text-zinc-600">Cuenta únicamente el efectivo de esta área. Si comparten cajón, separa los ingresos antes de capturar; este resumen no incluye fondo inicial ni retiros.</p>
        </div> : <p className="mt-3 text-sm text-zinc-600">Consulta de ingresos. Administración o gerencia realizan el cierre de Consultorio.</p>}

        <details className="mt-4 border-t border-zinc-200 pt-2">
          <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold text-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2">Ver ingresos y métodos de pago</summary>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {!consultorioIncluido && <Dato label="Ventas (farmacia)" valor={money(totalVentas)} />}
            {consultorioIncluido && <Dato label="Cobros (consultorio)" valor={money(totalCobros)} />}
            {!consultorioIncluido && <Dato label="N.º de ventas" valor={String(numVentas)} />}
            {!consultorioIncluido && <Dato label="Productos salidos" valor={String(productosSalidos)} />}
            {consultorioIncluido && <Dato label="Pacientes atendidos" valor={String(pacientesAtendidos)} />}
          </div>
          <ul className="mt-3 space-y-1">{metodos.length ? metodos.map(([m, v]) => <li key={m} className="flex justify-between gap-3 text-sm text-zinc-700"><span>{ETIQUETA_METODO[m] ?? m}</span><span className="tabular-nums">{money(v)}</span></li>) : <li className="text-sm text-zinc-500">Sin movimientos hoy.</li>}</ul>
        </details>
      </>}
      {mostrarAnterior && <p className="mt-3 text-sm text-zinc-600">Consultando un corte guardado. No registra un cierre nuevo.</p>}
      {msg && <p role="status" className="mt-3 text-sm text-zinc-800">{msg}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {ultimoCorte && <button type="button" disabled={pending || Boolean(guardado)} onClick={() => { const siguiente = !mostrarAnterior; setMostrarAnterior(siguiente); setVerComprobante(siguiente); }} className="min-h-11 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-800 disabled:opacity-50">{mostrarAnterior ? 'Volver al cierre del día' : 'Recuperar mi último corte guardado'}</button>}
        <button type="button" aria-expanded={verComprobante} aria-controls={comprobanteId} onClick={() => setVerComprobante(!verComprobante)} className="min-h-11 rounded-lg px-3 text-sm font-semibold text-zinc-800 underline focus-visible:outline-2 focus-visible:outline-offset-2">
          {verComprobante ? 'Ocultar ticket' : guardado || mostrarAnterior ? 'Ver ticket guardado' : 'Ver vista previa del ticket'}
        </button>
      </div>
    </div>
    {/* Siempre montado: plegar no dispara otra impresión. En papel nunca se oculta. */}
    <div id={comprobanteId} className={verComprobante ? 'mt-4' : 'hidden print:block'}>
      <CorteComprobante automatico={Boolean(guardado)} corte={comprobante} />
    </div>
  </section>;
}

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-0.5 text-base font-semibold tabular-nums text-zinc-900">
        {valor}
      </p>
    </div>
  );
}
