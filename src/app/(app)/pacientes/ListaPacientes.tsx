"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export type PacienteLista = {
  id: string;
  nombre: string;
  apellidos: string | null;
  telefono_wpp: string | null;
};

// Limpia el teléfono a formato wa.me (México = 52).
function waLink(tel: string | null): string | null {
  if (!tel) return null;
  let d = tel.replace(/\D/g, "");
  if (!d) return null;
  if (d.length === 10) d = "52" + d;
  return `https://wa.me/${d}`;
}

export default function ListaPacientes({
  pacientes,
}: {
  pacientes: PacienteLista[];
}) {
  const [q, setQ] = useState("");

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return pacientes;
    return pacientes.filter((p) =>
      `${p.nombre} ${p.apellidos ?? ""} ${p.telefono_wpp ?? ""}`
        .toLowerCase()
        .includes(t),
    );
  }, [q, pacientes]);

  return (
    <>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por nombre, apellido o WhatsApp…"
        className="mb-4 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900"
      />

      <div className="overflow-hidden rounded-xl bg-white ring-1 ring-zinc-200">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">WhatsApp</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-zinc-400">
                  {pacientes.length === 0
                    ? "Aún no hay pacientes."
                    : "Ningún paciente coincide con la búsqueda."}
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

      {q.trim() && (
        <p className="mt-2 text-xs text-zinc-400">
          {filtrados.length} de {pacientes.length} pacientes
        </p>
      )}
    </>
  );
}
