"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { crearReceta, type ItemReceta } from "./actions";

const input =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900";

const filaVacia: ItemReceta = {
  medicamento: "",
  dosis: "",
  duracion_dias: null,
  indicaciones: "",
};

const METRICAS: [string, string][] = [
  ["peso", "Peso (kg)"],
  ["estatura", "Estatura (m)"],
  ["imc", "IMC"],
  ["cintura", "Cintura (cm)"],
  ["peso_ideal", "Peso máximo ideal (kg)"],
  ["peso_sugerido", "Peso sugerido (kg)"],
];

export default function NuevaReceta({
  pacientes,
}: {
  pacientes: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [pacienteId, setPacienteId] = useState("");
  const [fase, setFase] = useState("");
  const [items, setItems] = useState<ItemReceta[]>([{ ...filaVacia }]);
  const [metricas, setMetricas] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function setItem(idx: number, patch: Partial<ItemReceta>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function guardar() {
    setMsg(null);
    startTransition(async () => {
      const res = await crearReceta(
        pacienteId,
        fase ? Number(fase) : null,
        items,
        metricas,
      );
      if (!res.ok) {
        setMsg(res.error ?? "Error.");
        return;
      }
      router.push(`/recetas/${res.id}`);
    });
  }

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="mb-6 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
      >
        + Nueva receta
      </button>
    );
  }

  return (
    <div className="mb-6 rounded-xl bg-white p-5 ring-1 ring-zinc-200">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600">
            Paciente *
          </label>
          <select
            value={pacienteId}
            onChange={(e) => setPacienteId(e.target.value)}
            className={input}
          >
            <option value="">Selecciona…</option>
            {pacientes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600">
            Fase
          </label>
          <select value={fase} onChange={(e) => setFase(e.target.value)} className={input}>
            <option value="">—</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                Fase {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-xs font-medium uppercase text-zinc-500">
          Control de peso (opcional)
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {METRICAS.map(([key, label]) => (
            <div key={key}>
              <label className="mb-1 block text-xs font-medium text-zinc-600">
                {label}
              </label>
              <input
                className={input}
                value={metricas[key] ?? ""}
                onChange={(e) =>
                  setMetricas((p) => ({ ...p, [key]: e.target.value }))
                }
              />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <p className="text-xs font-medium uppercase text-zinc-500">Medicamentos</p>
        {items.map((it, idx) => (
          <div key={idx} className="grid grid-cols-1 gap-2 rounded-lg bg-zinc-50 p-3 sm:grid-cols-12">
            <input
              className={`${input} sm:col-span-4`}
              placeholder="Medicamento"
              value={it.medicamento}
              onChange={(e) => setItem(idx, { medicamento: e.target.value })}
            />
            <input
              className={`${input} sm:col-span-3`}
              placeholder="Dosis (ej. 1 al día)"
              value={it.dosis}
              onChange={(e) => setItem(idx, { dosis: e.target.value })}
            />
            <input
              className={`${input} sm:col-span-2`}
              type="number"
              placeholder="Días"
              value={it.duracion_dias ?? ""}
              onChange={(e) =>
                setItem(idx, {
                  duracion_dias: e.target.value ? Number(e.target.value) : null,
                })
              }
            />
            <input
              className={`${input} sm:col-span-3`}
              placeholder="Indicaciones"
              value={it.indicaciones}
              onChange={(e) => setItem(idx, { indicaciones: e.target.value })}
            />
          </div>
        ))}
        <button
          onClick={() => setItems((p) => [...p, { ...filaVacia }])}
          className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
        >
          + Agregar medicamento
        </button>
      </div>

      {msg && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {msg}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <button
          onClick={guardar}
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {pending ? "Generando…" : "Generar receta"}
        </button>
        <button
          onClick={() => setAbierto(false)}
          className="rounded-lg px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
