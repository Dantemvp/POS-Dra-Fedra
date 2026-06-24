"use client";

import { useMemo, useState } from "react";
import { fechaSinaloa, horaSinaloa } from "@/lib/tz";

export type Mov = {
  id: number;
  fecha: string;
  persona: string;
  rol: string;
  area: string;
  severidad: "crear" | "editar" | "eliminar";
  titulo: string;
  detalle: string | null;
};

const SEV_STYLE: Record<Mov["severidad"], { dot: string; chip: string; label: string }> = {
  crear: { dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700", label: "Creó" },
  editar: { dot: "bg-amber-500", chip: "bg-amber-50 text-amber-700", label: "Editó" },
  eliminar: { dot: "bg-red-500", chip: "bg-red-50 text-red-700", label: "Eliminó" },
};

export default function MovimientosClient({ movimientos }: { movimientos: Mov[] }) {
  const [persona, setPersona] = useState("");
  const [area, setArea] = useState("");
  const [tipo, setTipo] = useState<"sensibles" | "todas" | "crear" | "editar" | "eliminar">(
    "sensibles",
  );
  const [q, setQ] = useState("");

  const personas = useMemo(
    () => [...new Set(movimientos.map((m) => m.persona))].sort(),
    [movimientos],
  );
  const areas = useMemo(
    () => [...new Set(movimientos.map((m) => m.area))].sort(),
    [movimientos],
  );

  const lista = useMemo(() => {
    const texto = q.trim().toLowerCase();
    return movimientos.filter((m) => {
      if (persona && m.persona !== persona) return false;
      if (area && m.area !== area) return false;
      if (tipo === "sensibles" && m.severidad === "crear") return false;
      if (["crear", "editar", "eliminar"].includes(tipo) && m.severidad !== tipo)
        return false;
      if (texto && !`${m.titulo} ${m.persona} ${m.detalle ?? ""}`.toLowerCase().includes(texto))
        return false;
      return true;
    });
  }, [movimientos, persona, area, tipo, q]);

  return (
    <div>
      {/* Filtros */}
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar…"
          className="min-w-[160px] flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
        />
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as typeof tipo)}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
        >
          <option value="sensibles">Sensibles (editar + eliminar)</option>
          <option value="todas">Todas</option>
          <option value="editar">Solo ediciones</option>
          <option value="eliminar">Solo eliminaciones</option>
          <option value="crear">Solo creaciones</option>
        </select>
        <select
          value={persona}
          onChange={(e) => setPersona(e.target.value)}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
        >
          <option value="">Toda persona</option>
          {personas.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          value={area}
          onChange={(e) => setArea(e.target.value)}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
        >
          <option value="">Toda área</option>
          {areas.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      <p className="mb-2 text-xs text-zinc-400">
        {lista.length} movimiento{lista.length === 1 ? "" : "s"}
      </p>

      <div className="overflow-hidden rounded-xl bg-white ring-1 ring-zinc-200">
        <ul className="divide-y divide-zinc-100">
          {lista.map((m) => {
            const s = SEV_STYLE[m.severidad];
            return (
              <li key={m.id} className="flex items-start gap-3 px-4 py-3">
                <span className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${s.dot}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-zinc-900">
                    <strong>{m.persona}</strong>{" "}
                    <span className="text-zinc-400">({m.rol})</span> {m.titulo}
                  </p>
                  {m.detalle && (
                    <p className="mt-0.5 font-mono text-xs text-zinc-600">{m.detalle}</p>
                  )}
                  <p className="mt-0.5 text-xs text-zinc-400">
                    <span className={`rounded px-1.5 py-0.5 ${s.chip}`}>{m.area}</span>{" "}
                    · {fechaSinaloa(m.fecha)} {horaSinaloa(m.fecha)}
                  </p>
                </div>
              </li>
            );
          })}
          {lista.length === 0 && (
            <li className="px-4 py-10 text-center text-sm text-zinc-400">
              Sin movimientos con estos filtros.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
