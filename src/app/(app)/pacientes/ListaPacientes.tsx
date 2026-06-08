"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { fechaSinaloa, horaSinaloa } from "@/lib/tz";

// Fecha y hora de captura en zona Sinaloa (ej. "7 jun 2026, 4:16 p.m.")
function captura(s: string | null): string {
  if (!s) return "";
  return `${fechaSinaloa(s)}, ${horaSinaloa(s)}`;
}

export type PacienteLista = {
  id: string;
  nombre: string;
  apellidos: string | null;
  telefono_wpp: string | null;
  creado_en: string | null;
  fase: number | null;
};

// Limpia el teléfono a formato wa.me (México = 52).
function waLink(tel: string | null): string | null {
  if (!tel) return null;
  let d = tel.replace(/\D/g, "");
  if (!d) return null;
  if (d.length === 10) d = "52" + d;
  return `https://wa.me/${d}`;
}

type Orden = "az" | "za" | "reciente" | "antiguo";

export default function ListaPacientes({
  pacientes,
}: {
  pacientes: PacienteLista[];
}) {
  const [q, setQ] = useState("");
  const [fase, setFase] = useState<string>("");
  const [orden, setOrden] = useState<Orden>("az");

  // Fases disponibles (para el dropdown).
  const fasesDisponibles = useMemo(
    () =>
      [...new Set(pacientes.map((p) => p.fase).filter((f): f is number => f != null))].sort(
        (a, b) => a - b,
      ),
    [pacientes],
  );

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    let r = pacientes.filter((p) => {
      const coincide =
        !t ||
        `${p.nombre} ${p.apellidos ?? ""} ${p.telefono_wpp ?? ""} ${captura(p.creado_en)}`
          .toLowerCase()
          .includes(t);
      const faseOk =
        fase === ""
          ? true
          : fase === "sin"
            ? p.fase == null
            : p.fase === Number(fase);
      return coincide && faseOk;
    });
    const t0 = (s: string | null) => (s ? new Date(s).getTime() : 0);
    r = [...r].sort((a, b) => {
      switch (orden) {
        case "za":
          return b.nombre.localeCompare(a.nombre);
        case "reciente":
          return t0(b.creado_en) - t0(a.creado_en);
        case "antiguo":
          return t0(a.creado_en) - t0(b.creado_en);
        default:
          return a.nombre.localeCompare(b.nombre);
      }
    });
    return r;
  }, [q, fase, orden, pacientes]);

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre, apellido, WhatsApp o fecha de captura…"
          className="min-w-[12rem] flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900"
        />
        <select
          value={fase}
          onChange={(e) => setFase(e.target.value)}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700"
        >
          <option value="">Todas las fases</option>
          {fasesDisponibles.map((f) => (
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
          <option value="az">Nombre (A–Z)</option>
          <option value="za">Nombre (Z–A)</option>
          <option value="reciente">Más reciente</option>
          <option value="antiguo">Más antiguo</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-xl bg-white ring-1 ring-zinc-200">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Fase</th>
              <th className="px-4 py-3">WhatsApp</th>
              <th className="px-4 py-3">Captura</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-400">
                  {pacientes.length === 0
                    ? "Aún no hay pacientes."
                    : "Ningún paciente coincide con los filtros."}
                </td>
              </tr>
            )}
            {filtrados.map((p) => {
              const wa = waLink(p.telefono_wpp);
              return (
                <tr key={p.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3 font-medium text-zinc-900">
                    {p.nombre} {p.apellidos ?? ""}
                  </td>
                  <td className="px-4 py-3">
                    {p.fase != null ? (
                      <span className="rounded-full bg-[#efe7db] px-2 py-0.5 text-xs font-medium text-[#8c7a63]">
                        Fase {p.fase}
                      </span>
                    ) : (
                      <span className="text-zinc-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {wa ? (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-700 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {p.telefono_wpp}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {captura(p.creado_en) || "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/pacientes/${p.id}`}
                      className="text-sm font-medium text-zinc-700 hover:text-zinc-900"
                    >
                      Ver →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {(q.trim() || fase) && (
        <p className="mt-2 text-xs text-zinc-400">
          {filtrados.length} de {pacientes.length} pacientes
        </p>
      )}
    </>
  );
}
