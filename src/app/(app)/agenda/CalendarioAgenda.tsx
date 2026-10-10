'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import RecordatorioWhatsApp from './RecordatorioWhatsApp';
import { agruparAgenda, diaAgenda, horaAgenda, type CitaCalendario } from '@/lib/agenda-vista';
export type { CitaCalendario as CitaCal } from '@/lib/agenda-vista';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const COLOR: Record<string, string> = { agendada: 'bg-zinc-500', confirmada: 'bg-green-600', atendida: 'bg-blue-600', cedida: 'bg-amber-600', cancelada: 'bg-red-500' };
const punto = (c: CitaCalendario) => c.origen === 'google' ? 'bg-brand-cocoa' : COLOR[c.estado] ?? 'bg-zinc-500';
const fechaTexto = (fecha: string) => new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mazatlan', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${diaAgenda(fecha)}T12:00:00-07:00`));

export function DetalleCitaAgenda({ cita: c, mostrarFecha = false }: { cita: CitaCalendario; mostrarFecha?: boolean }) {
  return <article className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="flex min-w-0 flex-1 items-start gap-3"><span aria-hidden="true" className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${punto(c)}`} /><div className="min-w-0">
        <p className="text-xs font-semibold tabular-nums text-zinc-700">{mostrarFecha && `${fechaTexto(c.fecha_hora)} · `}{horaAgenda(c)}</p>
        {c.paciente_id ? <Link href={`/pacientes/${c.paciente_id}`} className="mt-1 block break-words text-sm font-semibold text-zinc-900 hover:underline">{c.nombre}</Link> : <p className="mt-1 break-words text-sm font-semibold text-zinc-900">{c.nombre}</p>}
        {c.ubicacion && <p className="mt-1 break-words text-xs text-zinc-600">{c.ubicacion}</p>}
        {c.telefono_wpp && <p className="mt-1 text-xs text-zinc-600">WhatsApp: {c.telefono_wpp}</p>}
      </div></div>
      <span className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-semibold text-zinc-700">{c.origen === 'google' ? 'Google' : 'POS'}</span>
    </div>
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 pl-5 text-xs text-zinc-600"><span>{c.origen === 'google' ? 'Solo lectura' : c.estado}</span>{c.url && <a href={c.url} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-4">Ver en Google</a>}</div>
    {c.descripcion && <details className="mt-2 pl-5 text-sm text-zinc-700"><summary className="cursor-pointer py-2 font-medium">Notas y datos de la cita</summary><p className="whitespace-pre-wrap break-words rounded-lg border border-zinc-200 p-3">{c.descripcion}</p></details>}
    {!['cancelada', 'atendida', 'cedida'].includes(c.estado) && (c.origen === 'google' || c.tipo === 'cita_paciente') && <RecordatorioWhatsApp key={`${c.id}:${c.fecha_hora}:${c.nombre}:${c.telefono_wpp ?? ''}`} nombre={c.origen === 'google' ? '' : c.nombre} telefono={c.telefono_wpp} fecha={c.fecha_hora} diaCompleto={c.dia_completo} google={c.origen === 'google'} />}
  </article>;
}

export default function CalendarioAgenda({ citas, mes, onMesChange }: { citas: CitaCalendario[]; mes: string; onMesChange: (mes: string) => void }) {
  const hoy = diaAgenda(new Date().toISOString());
  const [seleccion, setSeleccion] = useState(hoy);
  const [ano, numero] = mes.split('-').map(Number);
  const sel = seleccion.startsWith(mes) ? seleccion : `${mes}-01`;
  const porDia = useMemo(() => agruparAgenda(citas, mes), [citas, mes]);
  const celdas = [...Array(new Date(ano, numero - 1, 1).getDay()).fill(null), ...Array.from({ length: new Date(ano, numero, 0).getDate() }, (_, i) => i + 1)];
  function mover(delta: number) { const fecha = new Date(ano, numero - 1 + delta, 1); onMesChange(`${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`); }
  const lista = porDia.get(sel) ?? [];
  return <div className="p-3 sm:p-5">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2">
      <button type="button" onClick={() => mover(-1)} aria-label="Mes anterior" className="h-11 w-11 rounded-lg border border-zinc-300 text-xl text-zinc-800 hover:bg-zinc-100">‹</button>
      <h2 className="min-w-32 text-center text-base font-semibold text-zinc-900">{MESES[numero - 1]} {ano}</h2>
      <button type="button" onClick={() => mover(1)} aria-label="Mes siguiente" className="h-11 w-11 rounded-lg border border-zinc-300 text-xl text-zinc-800 hover:bg-zinc-100">›</button>
    </div><button type="button" onClick={() => { onMesChange(hoy.slice(0, 7)); setSeleccion(hoy); }} className="min-h-11 rounded-lg border border-zinc-300 px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-100">Hoy</button></div>
    <div className="mb-3 flex flex-wrap gap-4 text-xs font-medium text-zinc-600"><span>● POS</span><span className="text-brand-cocoa dark:text-brand-sand">● Google · Solo lectura</span></div>
    <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-zinc-600">{DIAS.map(d => <div key={d} className="py-2">{d}</div>)}</div>
    <div className="grid grid-cols-7 gap-1">{celdas.map((n, i) => {
      if (!n) return <div key={`vacio-${i}`} />;
      const dia = `${mes}-${String(n).padStart(2, '0')}`;
      const citasDia = porDia.get(dia) ?? [];
      const activo = dia === sel;
      return <button type="button" key={dia} onClick={() => setSeleccion(dia)} aria-pressed={activo} aria-label={`${fechaTexto(dia)}, ${citasDia.length} citas`} className={`flex min-h-16 flex-col items-center rounded-lg border p-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 ${activo ? 'border-zinc-900 bg-zinc-900 text-white' : dia === hoy ? 'border-brand-taupe bg-zinc-50 font-semibold text-zinc-900' : 'border-transparent text-zinc-800 hover:bg-zinc-100'}`}>
        <span>{n}</span>{citasDia.length > 0 && <><span aria-hidden="true" className="mt-1 flex gap-1">{citasDia.slice(0, 3).map(c => <span key={c.id} className={`h-1.5 w-1.5 rounded-full ${activo ? 'bg-white' : punto(c)}`} />)}</span><span className="mt-1 text-[10px] tabular-nums">{citasDia.length}</span></>}
      </button>;
    })}</div>
    <div className="mt-4 border-t border-zinc-200 pt-4"><h3 className="mb-3 text-sm font-semibold capitalize text-zinc-900">{fechaTexto(sel)}</h3>{lista.length ? <div className="space-y-2">{lista.map(c => <DetalleCitaAgenda key={c.id} cita={c} />)}</div> : <p className="text-sm text-zinc-600">Sin citas cargadas para este día.</p>}</div>
  </div>;
}
