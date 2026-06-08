"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { fechaSinaloa } from "@/lib/tz";

export type RecetaLista = {
  id: string;
  folio: number;
  fecha: string;
  fase: number | null;
  paciente: string;
};

type Orden = "reciente" | "antiguo" | "folio";

export default function ListaRecetas({ recetas }: { recetas: RecetaLista[] }) {
  const [q, setQ] = useState("");
  const [fase, setFase] = useState("");
  const [orden, setOrden] = useState<Orden>("reciente");

  const fases = useMemo(
    () =>
      [...new Set(recetas.map((r) => r.fase).filter((f): f is number => f != null))].sort(
        (a, b) => a - b,
      ),
    [recetas],
  );

  const filtradas = useMemo(() => {
    const t = q.trim().toLowerCase();
    let r = recetas.filter((x) => {
      const coincide = !t || x.paciente.toLowerCase().includes(t);
      const faseOk =
        fase === "" ? true : fase === "sin" ? x.fase == null : x.fase === Number(fase);
      return coincide && faseOk;
    });
    const t0 = (s: string) => new Date(s).getTime();
    r = [...r].sort((a, b) => {
      if (orden === "antiguo") return t0(a.fecha) - t0(b.fecha);
      if (orden === "folio") return b.folio - a.folio;
      return t0(b.fecha) - t0(a.fecha);
    });
    return r;
  }, [q, fase, orden, recetas]);

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por paciente…"
          className="min-w-[12rem] flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
        />
        <select
          value={fase}
          onChange={(e) => setFase(e.target.value)}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700"
        >
          <option value="">Todas las fases</option>
          {fases.map((f) => (
            <option key={f} value={f}>
              Fase {f}
            </option>
          ))}
          <option value="sin">Sin fase</option>
        </select>
        <select
          value={orden}
          onChange={(e) => setOrden(e.target.value as Orden)}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700"
        >
          <option value="reciente">Más reciente</option>
          <option value="antiguo">Más antiguo</option>
          <option value="folio">Folio</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-xl bg-white ring-1 ring-zinc-200">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3">Folio</th>
              <th className="px-4 py-3">Paciente</th>
              <th className="px-4 py-3">Fase</th>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {filtradas.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-400">
                  {recetas.length === 0
                    ? "Sin recetas aún."
                    : "Ninguna receta coincide con los filtros."}
                </td>
              </tr>
            )}
            {filtradas.slice(0, 200).map((r) => (
              <tr key={r.id} className="hover:bg-zinc-50">
                <td className="px-4 py-3 font-medium text-zinc-900">#{r.folio}</td>
                <td className="px-4 py-3 text-zinc-700">{r.paciente}</td>
                <td className="px-4 py-3">
                  {r.fase != null ? (
                    <span className="rounded-full bg-[#efe7db] px-2 py-0.5 text-xs font-medium text-[#8c7a63]">
                      Fase {r.fase}
                    </span>
                  ) : (
                    <span className="text-zinc-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-600">
                  {fechaSinaloa(r.fecha)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/recetas/${r.id}`}
                    className="text-sm font-medium text-zinc-700 hover:text-zinc-900"
                  >
                    Imprimir →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(q.trim() || fase) && (
        <p className="mt-2 text-xs text-zinc-400">
          {filtradas.length} de {recetas.length} recetas
        </p>
      )}
    </>
  );
}
