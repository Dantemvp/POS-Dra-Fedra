"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

const money = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

const TZ = "America/Mazatlan";
const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export type CorteLista = {
  id: string;
  cierre: string;
  totalVentas: number;
  totalCobros: number;
  efectivoEsperado: number;
  efectivoContado: number | null;
  diferencia: number | null;
  productos: number | null;
  pacientes: number | null;
};

// Año/mes/día del cierre, en zona Sinaloa, sin depender del huso del navegador.
function partes(iso: string) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
  const [y, m, d] = f.split("-").map(Number);
  const dia = new Intl.DateTimeFormat("es-MX", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
  }).format(new Date(iso));
  const hora = new Intl.DateTimeFormat("es-MX", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
  return { y, m: m - 1, d, dia, hora };
}

export default function ListaCortes({ cortes }: { cortes: CorteLista[] }) {
  const [q, setQ] = useState("");

  // Agrupar año → mes, ya filtrado por el buscador.
  const grupos = useMemo(() => {
    const s = q.trim().toLowerCase();
    const porAnio = new Map<number, Map<number, (CorteLista & { p: ReturnType<typeof partes> })[]>>();
    for (const c of cortes) {
      const p = partes(c.cierre);
      const buscable = `${p.d} ${MESES[p.m]} ${p.y} ${p.dia}`.toLowerCase();
      if (s && !buscable.includes(s)) continue;
      if (!porAnio.has(p.y)) porAnio.set(p.y, new Map());
      const meses = porAnio.get(p.y)!;
      if (!meses.has(p.m)) meses.set(p.m, []);
      meses.get(p.m)!.push({ ...c, p });
    }
    return porAnio;
  }, [cortes, q]);

  const anios = Array.from(grupos.keys()).sort((a, b) => b - a);

  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por mes, año o día (ej. junio 2026)…"
        className="mb-4 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900"
      />

      {anios.length === 0 ? (
        <p className="rounded-xl bg-white px-4 py-8 text-center text-sm text-zinc-400 ring-1 ring-zinc-200">
          {cortes.length === 0 ? "Aún no hay cortes." : "Sin coincidencias."}
        </p>
      ) : (
        <div className="space-y-6">
          {anios.map((anio) => {
            const meses = Array.from(grupos.get(anio)!.keys()).sort((a, b) => b - a);
            return (
              <section key={anio}>
                <h2 className="mb-2 text-lg font-semibold text-zinc-900">{anio}</h2>
                <div className="space-y-4">
                  {meses.map((mes) => {
                    const lista = grupos.get(anio)!.get(mes)!;
                    return (
                      <div key={mes}>
                        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                          {MESES[mes]}
                        </h3>
                        <div className="overflow-hidden rounded-xl bg-white ring-1 ring-zinc-200">
                          <table className="w-full text-left text-sm">
                            <tbody className="divide-y divide-zinc-100">
                              {lista.map((c) => (
                                <tr key={c.id} className="hover:bg-zinc-50">
                                  <td className="px-4 py-3 capitalize text-zinc-800">
                                    {c.p.dia}{" "}
                                    <span className="text-xs text-zinc-400">
                                      {c.p.hora}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-right tabular-nums text-zinc-700">
                                    {money(c.totalVentas + c.totalCobros)}
                                  </td>
                                  <td className="px-4 py-3 text-right tabular-nums">
                                    {c.diferencia == null ? (
                                      <span className="text-zinc-300">—</span>
                                    ) : (
                                      <span
                                        className={
                                          c.diferencia === 0
                                            ? "text-green-700"
                                            : c.diferencia > 0
                                              ? "text-amber-700"
                                              : "text-red-600"
                                        }
                                      >
                                        {c.diferencia === 0
                                          ? "cuadrado"
                                          : money(c.diferencia)}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <Link
                                      href={`/cortes/${c.id}`}
                                      className="text-sm font-medium text-zinc-700 hover:text-zinc-900"
                                    >
                                      Ver →
                                    </Link>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
