"use client";

import { useActionState, useState } from "react";
import { crearServicio, actualizarServicio, type Result } from "./actions";

export type Servicio = {
  id: string;
  nombre: string;
  categoria: string | null;
  precio: number;
  activo: boolean;
};

const inicial: Result = { ok: false };

function FilaServicio({ s }: { s: Servicio }) {
  const [precio, setPrecio] = useState(String(s.precio));
  const [guardado, setGuardado] = useState<"idle" | "ok" | "err">("idle");

  async function guardar() {
    const n = Number(precio) || 0;
    const r = await actualizarServicio(s.id, { precio: n });
    setGuardado(r.ok ? "ok" : "err");
    setTimeout(() => setGuardado("idle"), 1500);
  }

  async function toggle() {
    await actualizarServicio(s.id, { activo: !s.activo });
  }

  return (
    <tr className={s.activo ? "" : "opacity-40"}>
      <td className="py-2 font-medium text-zinc-800">{s.nombre}</td>
      <td className="py-2 text-zinc-500">{s.categoria ?? "—"}</td>
      <td className="py-2">
        <div className="flex items-center gap-1">
          <span className="text-zinc-400">$</span>
          <input
            type="number"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            onBlur={guardar}
            className="w-24 rounded border border-zinc-300 px-2 py-1 text-right text-sm"
          />
          {guardado === "ok" && <span className="text-xs text-green-600">✓</span>}
          {guardado === "err" && <span className="text-xs text-red-600">✗</span>}
        </div>
      </td>
      <td className="py-2 text-right">
        <button
          onClick={toggle}
          className="text-xs text-zinc-500 hover:text-zinc-900"
        >
          {s.activo ? "Desactivar" : "Activar"}
        </button>
      </td>
    </tr>
  );
}

export default function ServiciosClient({
  servicios,
}: {
  servicios: Servicio[];
}) {
  const [estado, accion] = useActionState(crearServicio, inicial);

  return (
    <div className="space-y-6">
      <form
        action={accion}
        className="flex flex-wrap items-end gap-3 rounded-xl bg-white p-4 ring-1 ring-zinc-200"
      >
        <div>
          <label className="block text-xs text-zinc-500">Nombre</label>
          <input
            name="nombre"
            required
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm"
            placeholder="Ej. Toxina botulínica"
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-500">Categoría</label>
          <input
            name="categoria"
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm"
            placeholder="fase / facial / toxina"
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-500">Precio</label>
          <input
            name="precio"
            type="number"
            defaultValue="0"
            className="w-28 rounded border border-zinc-300 px-3 py-1.5 text-right text-sm"
          />
        </div>
        <button className="rounded-lg bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-700">
          Agregar
        </button>
        {estado.error && (
          <span className="text-sm text-red-600">{estado.error}</span>
        )}
      </form>

      <div className="rounded-xl bg-white p-4 ring-1 ring-zinc-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-400">
              <th className="pb-2">Servicio</th>
              <th className="pb-2">Categoría</th>
              <th className="pb-2">Precio</th>
              <th className="pb-2 text-right">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {servicios.map((s) => (
              <FilaServicio key={s.id} s={s} />
            ))}
            {servicios.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-zinc-400">
                  Sin servicios aún.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
