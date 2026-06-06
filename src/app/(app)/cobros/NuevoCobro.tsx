"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { crearCobro, type ItemCobro } from "./actions";

export type Paciente = { id: string; nombre: string };
export type Servicio = { id: string; nombre: string; precio: number };

type Metodo = "transferencia" | "efectivo" | "tarjeta" | "otro";

export default function NuevoCobro({
  pacientes,
  servicios,
}: {
  pacientes: Paciente[];
  servicios: Servicio[];
}) {
  const router = useRouter();
  const [pacienteId, setPacienteId] = useState("");
  const [items, setItems] = useState<ItemCobro[]>([
    { servicio_id: null, descripcion: "", cantidad: 1, precio_unit: 0 },
  ]);
  const [metodo, setMetodo] = useState<Metodo>("transferencia");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const total = useMemo(
    () =>
      items.reduce((s, i) => s + (i.precio_unit || 0) * (i.cantidad || 1), 0),
    [items],
  );

  function setItem(i: number, patch: Partial<ItemCobro>) {
    setItems((prev) =>
      prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)),
    );
  }

  function elegirServicio(i: number, sid: string) {
    const s = servicios.find((x) => x.id === sid);
    setItem(i, {
      servicio_id: sid || null,
      descripcion: s?.nombre ?? "",
      precio_unit: s ? Number(s.precio) : items[i].precio_unit,
    });
  }

  function agregarFila() {
    setItems((p) => [
      ...p,
      { servicio_id: null, descripcion: "", cantidad: 1, precio_unit: 0 },
    ]);
  }

  function quitarFila(i: number) {
    setItems((p) => (p.length === 1 ? p : p.filter((_, idx) => idx !== i)));
  }

  async function guardar() {
    setError("");
    setGuardando(true);
    const r = await crearCobro({
      paciente_id: pacienteId,
      items,
      metodo,
      monto: total,
      nota,
    });
    setGuardando(false);
    if (!r.ok) {
      setError(r.error ?? "Error al guardar.");
      return;
    }
    router.push("/cobros");
    router.refresh();
  }

  const fmt = (n: number) =>
    n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

  return (
    <div className="space-y-5 rounded-xl bg-white p-5 ring-1 ring-zinc-200">
      <div>
        <label className="block text-xs text-zinc-500">Paciente</label>
        <select
          value={pacienteId}
          onChange={(e) => setPacienteId(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        >
          <option value="">— Selecciona —</option>
          {pacientes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="block text-xs text-zinc-500">Servicios</label>
        {items.map((it, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <select
              value={it.servicio_id ?? ""}
              onChange={(e) => elegirServicio(i, e.target.value)}
              className="min-w-[10rem] flex-1 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
            >
              <option value="">— Servicio / libre —</option>
              {servicios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
            {!it.servicio_id && (
              <input
                placeholder="Concepto"
                value={it.descripcion}
                onChange={(e) => setItem(i, { descripcion: e.target.value })}
                className="flex-1 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
              />
            )}
            <input
              type="number"
              min={1}
              value={it.cantidad}
              onChange={(e) =>
                setItem(i, { cantidad: Number(e.target.value) || 1 })
              }
              className="w-14 rounded-lg border border-zinc-300 px-2 py-1.5 text-center text-sm"
            />
            <div className="flex items-center gap-1">
              <span className="text-zinc-400">$</span>
              <input
                type="number"
                value={it.precio_unit}
                onChange={(e) =>
                  setItem(i, { precio_unit: Number(e.target.value) || 0 })
                }
                className="w-24 rounded-lg border border-zinc-300 px-2 py-1.5 text-right text-sm"
              />
            </div>
            <button
              onClick={() => quitarFila(i)}
              className="text-zinc-400 hover:text-red-600"
              title="Quitar"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          onClick={agregarFila}
          className="text-sm text-zinc-500 hover:text-zinc-900"
        >
          + Agregar servicio
        </button>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 border-t border-zinc-100 pt-4">
        <div>
          <label className="block text-xs text-zinc-500">Método de pago</label>
          <select
            value={metodo}
            onChange={(e) => setMetodo(e.target.value as Metodo)}
            className="mt-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="transferencia">Transferencia</option>
            <option value="efectivo">Efectivo</option>
            <option value="tarjeta">Tarjeta</option>
            <option value="otro">Otro</option>
          </select>
        </div>
        <div className="text-right">
          <p className="text-xs text-zinc-500">Total</p>
          <p className="text-2xl font-semibold text-zinc-900">{fmt(total)}</p>
        </div>
      </div>

      <input
        placeholder="Nota (opcional)"
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        onClick={guardar}
        disabled={guardando}
        className="w-full rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
      >
        {guardando ? "Guardando…" : "Registrar cobro"}
      </button>
    </div>
  );
}
