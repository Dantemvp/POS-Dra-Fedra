'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { EventoGoogle } from '@/lib/google-calendario-seguridad';
import { agruparAgenda, diaAgenda, proximasAgenda, unirAgenda, type CitaCalendario } from '@/lib/agenda-vista';
import { iniciarRefrescoAgenda } from '@/lib/agenda-refresco';
import CalendarioAgenda, { DetalleCitaAgenda } from './CalendarioAgenda';

type Resultado = { conectado: boolean; eventos: EventoGoogle[]; actualizado?: string };
export default function GoogleCalendario({ citas, puedeConectar, estadoOAuth }: { citas: CitaCalendario[]; puedeConectar: boolean; estadoOAuth?: string }) {
  const [mes, setMes] = useState(() => diaAgenda(new Date().toISOString()).slice(0, 7));
  const [resultado, setResultado] = useState<(Resultado & { mes: string }) | null>(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const refresco = useRef<ReturnType<typeof iniciarRefrescoAgenda<Resultado>> | null>(null);
  useEffect(() => {
    const ciclo = iniciarRefrescoAgenda<Resultado>({
      documento: document, ventana: window, cargando: setCargando,
      consultar: async signal => {
        const res = await fetch(`/api/google-calendario/eventos?mes=${encodeURIComponent(mes)}`, { cache: 'no-store', signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]) });
        if (res.redirected || res.status === 403) throw new Error('Tu sesión no permite consultar Google. Recarga e inicia sesión.');
        const datos = await res.json();
        if (!res.ok) throw new Error(datos.error || 'No se pudo consultar Google.');
        return datos;
      },
      recibir: datos => { setResultado({ ...datos, mes }); setError(''); },
      fallar: e => setError(e instanceof Error ? e.message : 'No se pudo actualizar Google.'),
    });
    refresco.current = ciclo;
    return () => { ciclo.detener(); refresco.current = null; };
  }, [mes]);
  const actual = resultado?.mes === mes ? resultado : null;
  const unificadas = useMemo(() => unirAgenda(citas, actual?.eventos ?? []), [citas, actual]);
  const idsMes = useMemo(() => new Set([...agruparAgenda(unificadas, mes).values()].flat().map(c => c.id)), [unificadas, mes]);
  const proximas = proximasAgenda(unificadas).filter(c => idsMes.has(c.id));
  const falloOAuth = estadoOAuth && estadoOAuth !== 'conectado' && !actual?.conectado;
  return <section className="mb-6 overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-200">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 sm:px-5">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-zinc-900">Agenda del consultorio</p>
        <p className="mt-1 text-xs text-zinc-600" role="status">{cargando ? 'Actualizando Google…' : error ? 'Google pendiente de actualizar' : actual?.conectado ? 'Google conectado · Actualización cada minuto' : 'Google sin conectar'}</p>
        {actual?.actualizado && <p className="mt-1 text-xs text-zinc-600">Última lectura: {new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mazatlan', hour: 'numeric', minute: '2-digit', second: '2-digit' }).format(new Date(actual.actualizado))}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={cargando} onClick={() => { void refresco.current?.actualizar(); }} className="min-h-11 rounded-lg border border-zinc-300 px-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50">Actualizar</button>
        <a href="https://calendar.google.com/" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-zinc-700 underline underline-offset-4">Abrir Google</a>
        {puedeConectar && (error || falloOAuth || actual?.conectado === false) && <a className="inline-flex min-h-11 items-center rounded-lg bg-zinc-900 px-3 text-sm font-semibold text-white" href="/api/google-calendario/conectar">Conectar Google</a>}
      </div>
    </div>
    {(error || falloOAuth) && <p role="alert" className="mx-4 mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{error || 'No se completó la autorización de Google. Vuelve a conectar.'}{actual?.conectado && ' Las citas de Google que ves son de la última lectura; pueden haber cambiado.'}</p>}
    <CalendarioAgenda citas={unificadas} mes={mes} onMesChange={setMes} />
    <div className="border-t border-zinc-200 p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2"><h2 className="font-semibold text-zinc-900">Próximas citas del mes</h2><span className="text-xs text-zinc-600">Google y POS · Hora de Sinaloa</span></div>
      {proximas.length ? <div className="max-h-96 space-y-2 overflow-y-auto">{proximas.map(c => <DetalleCitaAgenda key={c.id} cita={c} mostrarFecha />)}</div> : <p className="text-sm text-zinc-600">{cargando ? 'Consultando las citas de Google…' : error ? 'No se pudo comprobar si hay próximas citas en Google.' : 'No hay próximas citas en este mes.'}</p>}
      <p className="mt-3 text-xs text-zinc-600">Google se consulta en modo lectura. Las notas y datos de contacto disponibles se muestran en cada cita; todavía no se envían recordatorios.</p>
    </div>
  </section>;
}
