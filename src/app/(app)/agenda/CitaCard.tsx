"use client";

import { useState, useTransition } from "react";
import {
  cambiarEstadoCita,
  marcarRecordatorio,
  type Result,
} from "./actions";
import { TIPOS_CITA } from "./tipos";
import type { Cita } from "./page";
import RecordatorioWhatsApp from './RecordatorioWhatsApp';

const TZ = "America/Mazatlan";

const TIPO_LABEL: Record<string, string> = Object.fromEntries(
  TIPOS_CITA.map((t) => [t.v, t.l]),
);

const BADGE: Record<Cita["estado"], string> = {
  agendada: "bg-amber-100 text-amber-700",
  confirmada: "bg-green-100 text-green-700",
  atendida: "bg-zinc-200 text-zinc-600",
  cedida: "bg-zinc-200 text-zinc-600",
  cancelada: "bg-red-100 text-red-700",
};

function hora(iso: string) {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

export default function CitaCard({
  cita,
  vencida = false,
}: {
  cita: Cita;
  vencida?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const p = cita.paciente;
  const esPaciente = cita.tipo === "cita_paciente";
  const nombre = p
    ? `${p.nombre} ${p.apellidos ?? ""}`.trim()
    : cita.titulo ?? "Evento";

  function run(fn: () => Promise<Result>) {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Error.");
    });
  }

  const cerrada =
    cita.estado === "atendida" ||
    cita.estado === "cedida" ||
    cita.estado === "cancelada";

  return (
    <div
      className={`rounded-xl bg-white p-4 ring-1 ${
        vencida
          ? "border-l-4 border-red-500 ring-red-200"
          : "ring-zinc-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-zinc-900">
              {hora(cita.fecha_hora)}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${BADGE[cita.estado]}`}
            >
              {cita.estado}
            </span>
            {!esPaciente && (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase text-zinc-600">
                {TIPO_LABEL[cita.tipo] ?? "Evento"}
              </span>
            )}
            {cita.recordatorio_enviado && (
              <span className="text-[10px] text-zinc-400">recordado ✓</span>
            )}
            {vencida && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium uppercase text-red-700">
                confirmación vencida
              </span>
            )}
          </div>
          <p className="mt-1 truncate text-sm text-zinc-700">{nombre}</p>
          {cita.notas && (
            <p className="mt-0.5 truncate text-xs text-zinc-400">{cita.notas}</p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          {esPaciente && !cerrada && !cita.recordatorio_enviado && <button type="button" disabled={pending} onClick={() => { if (window.confirm('¿Ya envió el recordatorio desde WhatsApp? Abrir el chat no lo envía.')) run(() => marcarRecordatorio(cita.id)); }} className="min-h-11 rounded-lg border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700">Ya envié el recordatorio</button>}
          {esPaciente && cita.estado === "agendada" && (
            <button
              disabled={pending}
              onClick={() => run(() => cambiarEstadoCita(cita.id, "confirmada"))}
              className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              Confirmar
            </button>
          )}
          {!cerrada && (
            <button
              disabled={pending}
              onClick={() => run(() => cambiarEstadoCita(cita.id, "atendida"))}
              className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              Atendida
            </button>
          )}
          {!cerrada && (
            <button
              disabled={pending}
              onClick={() => run(() => cambiarEstadoCita(cita.id, "cancelada"))}
              className="rounded-lg px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              Cancelar
            </button>
          )}
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {esPaciente && !cerrada && <RecordatorioWhatsApp key={`${cita.id}:${cita.fecha_hora}:${nombre}:${p?.telefono_wpp ?? ''}`} nombre={nombre} telefono={p?.telefono_wpp} fecha={cita.fecha_hora} />}
    </div>
  );
}
