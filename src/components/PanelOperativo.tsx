'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { iniciarRefrescoAgenda } from '@/lib/agenda-refresco';
import { avisosPanel, type PanelDatos } from '@/lib/panel-operativo';
import { diaAgenda, proximasAgenda, unirAgenda } from '@/lib/agenda-vista';
import { crearLecturaGoogle, type LecturaGoogle } from '@/lib/google-lectura-compartida';
import type { Rol } from '@/lib/auth';
import { DetalleCitaAgenda } from '@/app/(app)/agenda/CalendarioAgenda';

async function consultarMes(mes: string): Promise<LecturaGoogle> {
  const res = await fetch(`/api/google-calendario/eventos?mes=${encodeURIComponent(mes)}`, { cache: 'no-store', signal: AbortSignal.timeout(30000) });
  if (res.redirected || res.status === 403) throw new Error('Tu sesión no permite consultar Google.');
  if (!res.ok) throw new Error('Google pendiente de actualizar. Revisa la conexión en Agenda.');
  return res.json();
}
type EstadoPanel = { datos: PanelDatos | null; error: string; errorGoogle: string; cargando: boolean; actualizar: () => void; consultarGoogle: (mes: string) => Promise<LecturaGoogle> };
const Contexto = createContext<EstadoPanel | null>(null);
export function useLecturaGoogle() { return useContext(Contexto)?.consultarGoogle ?? consultarMes; }

export function PanelOperativoProvider({ rol, sesion, children }: { rol: Rol; sesion: string; children: React.ReactNode }) {
  const [datos, setDatos] = useState<PanelDatos | null>(null);
  const [error, setError] = useState('');
  const [errorGoogle, setErrorGoogle] = useState('');
  const [cargando, setCargando] = useState(true);
  const consultarGoogle = useMemo(() => crearLecturaGoogle(consultarMes), []);
  const ciclo = useRef<ReturnType<typeof iniciarRefrescoAgenda> | null>(null);
  const ultimaGoogle = useRef<LecturaGoogle['eventos']>([]);
  const actualizar = useCallback(() => { void ciclo.current?.actualizar(); }, []);
  useEffect(() => {
    const trabajo = iniciarRefrescoAgenda<{ datos: PanelDatos; errorGoogle: string }>({ documento: document, ventana: window, cargando: setCargando,
      consultar: async signal => {
        const res = await fetch('/api/panel-operativo', { cache: 'no-store', signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]) });
        if (res.redirected || res.status === 403) { setDatos(null); ultimaGoogle.current = []; throw new Error('Recarga e inicia sesión para ver tus avisos.'); }
        if (!res.ok) throw new Error('No se pudo actualizar el panel. Los datos visibles son de la última lectura.');
        const base: PanelDatos = await res.json();
        if (base.sesion !== sesion || base.rol !== rol) { setDatos(null); ultimaGoogle.current = []; throw new Error('La sesión o los permisos cambiaron. Recarga el POS antes de continuar.'); }
        let fallo = '';
        if (rol !== 'farmacia') {
          const hoy = diaAgenda(new Date().toISOString());
          const fin = diaAgenda(new Date(Date.now() + 6 * 86400000).toISOString());
          const meses = [...new Set([hoy.slice(0, 7), fin.slice(0, 7)])];
          try {
            const lecturas = await Promise.all(meses.map(consultarGoogle));
            if (lecturas.some(l => !l.conectado)) { ultimaGoogle.current = []; fallo = 'Google sin conectar. Revisa Agenda.'; }
            else ultimaGoogle.current = lecturas.flatMap(l => l.eventos);
          } catch { fallo = 'Google pendiente de actualizar. Las citas visibles pueden haber cambiado.'; }
          base.citas = proximasAgenda(unirAgenda(base.citas, ultimaGoogle.current)).filter(c => diaAgenda(c.fecha_hora) <= fin);
        }
        return { datos: base, errorGoogle: fallo };
      },
      recibir: r => { setDatos(r.datos); setErrorGoogle(r.errorGoogle); setError(''); },
      fallar: e => setError(e instanceof Error ? e.message : 'No se pudo actualizar el panel.'),
    });
    ciclo.current = trabajo;
    return () => { trabajo.detener(); ciclo.current = null; };
  }, [rol, sesion, consultarGoogle]);
  return <Contexto.Provider value={{ datos, error, errorGoogle, cargando, actualizar, consultarGoogle }}>{children}</Contexto.Provider>;
}

export function CampanaNotificaciones() {
  const estado = useContext(Contexto);
  const [abierta, setAbierta] = useState(false);
  const zona = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!abierta) return;
    function cerrar(e: MouseEvent) { if (!zona.current?.contains(e.target as Node)) setAbierta(false); }
    document.addEventListener('mousedown', cerrar);
    return () => document.removeEventListener('mousedown', cerrar);
  }, [abierta]);
  if (!estado) return null;
  const avisos = estado.datos ? avisosPanel(estado.datos) : [];
  const errores = [estado.error, estado.errorGoogle].filter(Boolean);
  const total = avisos.length + errores.length;
  return <div ref={zona} className="relative print:hidden" onKeyDown={e => { if (e.key === 'Escape') { setAbierta(false); boton.current?.focus(); } }}>
    <button ref={boton} type="button" aria-label={`Notificaciones: ${total} categorías con avisos`} aria-expanded={abierta} onClick={() => setAbierta(!abierta)} className="relative flex min-h-11 min-w-11 items-center justify-center rounded-lg text-zinc-800 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2">
      <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
      {(total > 0 || estado.cargando) && <span className="absolute right-0 top-0 rounded-full bg-[#3f5148] px-1.5 text-[10px] font-bold text-[#ffffff]">{total || '…'}</span>}
    </button>
    {abierta && <section aria-label="Avisos operativos" className="fixed left-3 right-3 top-16 z-50 mt-2 max-h-[75vh] overflow-y-auto rounded-xl bg-white p-4 text-zinc-900 shadow-xl ring-1 ring-zinc-300 md:absolute md:left-auto md:right-0 md:top-full md:w-96">
      <div className="mb-3 flex items-center justify-between gap-3"><h2 className="font-semibold">Pendientes y actividad</h2><button type="button" onClick={() => setAbierta(false)} className="min-h-11 px-2 text-sm underline">Cerrar avisos</button></div>
      <p className="mb-3 text-xs text-zinc-600">El contador indica categorías activas, no mensajes sin leer. Abrirlo no resuelve pendientes.</p>
      {errores.map(txt => <p key={txt} role="alert" className="mb-2 rounded-lg border border-amber-300 p-3 text-sm">{txt}</p>)}
      {(['consultorio', 'farmacia', 'sistema'] as const).map(area => {
        const grupo = avisos.filter(a => a.area === area);
        return grupo.length ? <div key={area} className="mb-4"><h3 className="mb-2 text-xs font-semibold uppercase text-zinc-600">{area === 'sistema' ? 'Sistema y caja' : area}</h3>
          {grupo.map(a => <Link key={a.id} href={a.href} onClick={() => setAbierta(false)} className="mb-2 block rounded-lg border border-zinc-200 p-3 text-sm hover:bg-zinc-50"><strong>{a.nivel === 'urgente' ? 'Atención: ' : ''}{a.titulo} ({a.cantidad})</strong><span className="mt-1 block text-xs text-zinc-600">{a.detalle}</span></Link>)}
        </div> : null;
      })}
      {!total && <p className="py-3 text-sm text-zinc-600">{estado.cargando ? 'Consultando los pendientes…' : 'Sin avisos en los datos comprobados.'}</p>}
      <div className="flex flex-wrap gap-2 border-t border-zinc-200 pt-3"><button type="button" disabled={estado.cargando} onClick={estado.actualizar} className="min-h-11 px-2 text-sm underline disabled:opacity-50">Actualizar</button><Link href="/notificaciones" onClick={() => setAbierta(false)} className="inline-flex min-h-11 items-center text-sm underline">Avisos en mi dispositivo</Link></div>
    </section>}
  </div>;
}

export function AgendaInicio() {
  const estado = useContext(Contexto);
  if (!estado) return null;
  const citas = estado.datos?.citas ?? [];
  const hoy = diaAgenda(new Date().toISOString());
  const deHoy = citas.filter(c => diaAgenda(c.fecha_hora) === hoy);
  return <section className="rounded-xl bg-white p-5 ring-1 ring-zinc-200" aria-label="Agenda unificada de Inicio">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold text-zinc-900">Agenda de la doctora</h2><Link href="/agenda" className="min-h-11 content-center text-sm underline text-zinc-700">Ver agenda completa</Link></div>
    {(estado.error || estado.errorGoogle) && <p role="alert" className="mb-3 rounded-lg border border-amber-300 p-3 text-sm text-zinc-800">{estado.error || estado.errorGoogle}</p>}
    <details className="group">
      <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm text-zinc-700 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden">
        <span>{estado.datos ? `${deHoy.length} ${deHoy.length === 1 ? 'cita próxima' : 'citas próximas'} hoy · ${citas.length} en los próximos 7 días` : 'Consultando las citas…'} · Google y POS</span>
        <span className="inline-flex items-center gap-2 font-semibold text-zinc-900">
          <span className="group-open:hidden">Ver citas</span><span className="hidden group-open:inline">Ocultar citas</span>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="transition-transform group-open:rotate-180"><path d="m6 9 6 6 6-6" /></svg>
        </span>
      </summary>
      <div className="mt-3 max-h-[32rem] space-y-2 overflow-y-auto">{citas.slice(0, 8).map(c => <DetalleCitaAgenda key={c.id} cita={c} mostrarFecha />)}</div>
      {estado.datos && !citas.length && !estado.error && !estado.errorGoogle && <p className="mt-3 text-sm text-zinc-600">Sin citas próximas en esta ventana.</p>}
      {citas.length > 8 && <p className="mt-3 text-xs text-zinc-600">Mostrando las primeras 8 citas. El resto está en Agenda.</p>}
    </details>
  </section>;
}
