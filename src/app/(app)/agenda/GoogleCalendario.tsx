'use client';

import { useEffect, useState } from 'react';
import type { EventoGoogle } from '@/lib/google-calendario-seguridad';

export default function GoogleCalendario({ puedeConectar, estadoOAuth }: { puedeConectar: boolean; estadoOAuth?: string }) {
  const [abierto, setAbierto] = useState(Boolean(estadoOAuth));
  const [mes, setMes] = useState(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mazatlan', year: 'numeric', month: '2-digit' }).format(new Date()).slice(0, 7));
  const [vuelta, setVuelta] = useState(0);
  const [resultado, setResultado] = useState<{ conectado: boolean; eventos: EventoGoogle[]; actualizado?: string } | null>(null);
  const [error, setError] = useState(estadoOAuth && estadoOAuth !== 'conectado' ? 'No se completó la conexión. Verifica la cuenta, los permisos de lectura y la configuración de Google antes de reintentar.' : '');
  const [cargando, setCargando] = useState(Boolean(estadoOAuth));
  function prepararConsulta() { setCargando(true); setResultado(null); setError(''); }
  useEffect(() => {
    if (!abierto) return;
    const controller = new AbortController();
    fetch(`/api/google-calendario/eventos?mes=${encodeURIComponent(mes)}`, { cache: 'no-store', signal: controller.signal })
      .then(async res => {
        const datos = await res.json();
        if (!res.ok) throw new Error(datos.error || 'No se pudo consultar Google.');
        if (!controller.signal.aborted) setResultado(datos);
      }).catch(e => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setCargando(false); });
    return () => controller.abort();
  }, [abierto, mes, vuelta]);
  return <section className="mb-6 rounded-xl border border-zinc-300 bg-white p-4 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100">
    <button type="button" className="min-h-11 w-full text-left font-semibold" aria-expanded={abierto} aria-controls="agenda-google" onClick={() => { if (!abierto) prepararConsulta(); setAbierto(!abierto); }}>{abierto ? '▾' : '▸'} Calendario de Google · Solo lectura</button>
    {abierto && <div id="agenda-google" className="mt-3 space-y-3">
      <p className="text-sm">Consulta el calendario principal de la doctora. Los cambios se hacen en Google; esta vista no crea ni modifica citas.</p>
      <div className="flex flex-wrap items-center gap-3">
        <label>Mes <input aria-label="Mes del calendario de Google" type="month" value={mes} onChange={e => { prepararConsulta(); setMes(e.target.value); }} className="rounded border border-zinc-400 bg-transparent p-2" /></label>
        <button type="button" disabled={cargando} onClick={() => { prepararConsulta(); setVuelta(v => v + 1); }} className="min-h-11 rounded bg-zinc-900 px-4 font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">Actualizar</button>
        <a href="https://calendar.google.com/" target="_blank" rel="noreferrer" className="underline">Abrir Google Calendar</a>
      </div>
      {cargando && <p role="status">Consultando Google…</p>}
      {error && <p role="alert" className="text-red-700 dark:text-red-300">{error}</p>}
      {resultado && !resultado.conectado && <p>Falta autorizar la cuenta en modo lectura.</p>}
      {puedeConectar && (error || resultado?.conectado === false) && <a className="inline-block rounded bg-zinc-900 px-4 py-3 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900" href="/api/google-calendario/conectar">Conectar Google en modo lectura</a>}
      {resultado?.conectado && <>
        <p className="text-sm">Actualizado: {new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mazatlan', dateStyle: 'short', timeStyle: 'short' }).format(new Date(resultado.actualizado!))}</p>
        {resultado.eventos.length === 0 ? <p>No hay eventos en este mes.</p> : <ul className="divide-y divide-zinc-200 dark:divide-zinc-700">{resultado.eventos.map(evento => <li key={evento.id} className="py-3"><p className="font-medium">{evento.titulo}</p><p className="text-sm">{evento.diaCompleto ? `${evento.inicio} · Todo el día` : new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mazatlan', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(evento.inicio))}</p></li>)}</ul>}
      </>}
    </div>}
  </section>;
}
