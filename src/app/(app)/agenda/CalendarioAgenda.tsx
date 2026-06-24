"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

const TZ = "America/Mazatlan";

export type CitaCal = {
  id: string;
  fecha_hora: string;
  estado: string;
  tipo: string;
  paciente_id: string | null;
  nombre: string;
};

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const COLOR: Record<string, string> = {
  agendada: "bg-zinc-400",
  confirmada: "bg-green-500",
  atendida: "bg-blue-500",
  cedida: "bg-amber-500",
  cancelada: "bg-red-400",
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}
// Clave YYYY-MM-DD del instante en zona Sinaloa
function claveDia(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}
function hora(iso: string) {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default function CalendarioAgenda({ citas }: { citas: CitaCal[] }) {
  // Mes visible (hoy en Sinaloa)
  const hoyKey = claveDia(new Date().toISOString());
  const [hy, hm] = hoyKey.split("-").map(Number);
  const [year, setYear] = useState(hy);
  const [month, setMonth] = useState(hm - 1); // 0-indexed
  const [sel, setSel] = useState<string | null>(hoyKey);

  // Citas agrupadas por día
  const porDia = useMemo(() => {
    const m = new Map<string, CitaCal[]>();
    for (const c of citas) {
      const k = claveDia(c.fecha_hora);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(c);
    }
    for (const arr of m.values())
      arr.sort((a, b) => a.fecha_hora.localeCompare(b.fecha_hora));
    return m;
  }, [citas]);

  const diasMes = new Date(year, month + 1, 0).getDate();
  const primerDiaSemana = new Date(year, month, 1).getDay();
  const celdas: (number | null)[] = [
    ...Array(primerDiaSemana).fill(null),
    ...Array.from({ length: diasMes }, (_, i) => i + 1),
  ];

  function mover(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setMonth(m);
    setYear(y);
  }

  const selCitas = sel ? porDia.get(sel) ?? [] : [];

  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-zinc-200">
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => mover(-1)}
          className="rounded-lg px-2 py-1 text-zinc-500 hover:bg-zinc-100"
          aria-label="Mes anterior"
        >
          ‹
        </button>
        <h2 className="text-sm font-semibold text-zinc-800">
          {MESES[month]} {year}
        </h2>
        <button
          onClick={() => mover(1)}
          className="rounded-lg px-2 py-1 text-zinc-500 hover:bg-zinc-100"
          aria-label="Mes siguiente"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium uppercase tracking-wide text-zinc-400">
        {DIAS.map((d) => (
          <div key={d} className="py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {celdas.map((dia, i) => {
          if (dia === null) return <div key={`e${i}`} />;
          const key = `${year}-${pad(month + 1)}-${pad(dia)}`;
          const lista = porDia.get(key) ?? [];
          const esHoy = key === hoyKey;
          const activo = key === sel;
          return (
            <button
              key={key}
              onClick={() => setSel(key)}
              title={
                lista.length
                  ? lista.map((c) => `${hora(c.fecha_hora)} · ${c.nombre}`).join("\n")
                  : undefined
              }
              className={`relative flex h-14 flex-col items-center justify-start rounded-lg border p-1 text-sm transition ${
                activo
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : esHoy
                    ? "border-zinc-400 bg-zinc-50 text-zinc-900"
                    : "border-transparent text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              <span className={esHoy && !activo ? "font-bold" : ""}>{dia}</span>
              {lista.length > 0 && (
                <span className="mt-0.5 flex flex-wrap items-center justify-center gap-0.5">
                  {lista.slice(0, 3).map((c) => (
                    <span
                      key={c.id}
                      className={`h-1.5 w-1.5 rounded-full ${COLOR[c.estado] ?? "bg-zinc-400"}`}
                    />
                  ))}
                  {lista.length > 3 && (
                    <span className={`text-[9px] ${activo ? "text-white" : "text-zinc-500"}`}>
                      +{lista.length - 3}
                    </span>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Panel del día seleccionado */}
      <div className="mt-4 border-t border-zinc-100 pt-3">
        {selCitas.length === 0 ? (
          <p className="text-sm text-zinc-400">
            Sin citas este día.
          </p>
        ) : (
          <div className="space-y-1.5">
            {selCitas.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${COLOR[c.estado] ?? "bg-zinc-400"}`}
                  />
                  <span className="font-medium text-zinc-800">
                    {hora(c.fecha_hora)}
                  </span>
                  {c.paciente_id ? (
                    <Link
                      href={`/pacientes/${c.paciente_id}`}
                      className="text-zinc-600 hover:text-zinc-900 hover:underline"
                    >
                      {c.nombre}
                    </Link>
                  ) : (
                    <span className="text-zinc-600">{c.nombre}</span>
                  )}
                </div>
                <span className="text-xs capitalize text-zinc-400">{c.estado}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
