"use client";

import { useState, useTransition } from "react";
import { crearHistoria } from "../actions";

export type Campo = {
  id: string;
  etiqueta: string;
  tipo_dato: string;
  opciones: string[] | null;
  orden: number;
  requerido: boolean;
};
export type Tipo = {
  id: string;
  nombre: string;
  campos_historia: Campo[];
};

const input =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900";

export default function NuevaHistoria({
  pacienteId,
  tipos,
}: {
  pacienteId: string;
  tipos: Tipo[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [tipoId, setTipoId] = useState("");
  const [valores, setValores] = useState<Record<string, unknown>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const tipo = tipos.find((t) => t.id === tipoId);

  function setCampo(id: string, v: unknown) {
    setValores((prev) => ({ ...prev, [id]: v }));
  }

  function guardar() {
    setMsg(null);
    if (!tipoId) {
      setMsg("Selecciona un tipo de historia.");
      return;
    }
    startTransition(async () => {
      const res = await crearHistoria(pacienteId, tipoId, valores);
      if (!res.ok) {
        setMsg(res.error ?? "Error al guardar.");
        return;
      }
      setValores({});
      setTipoId("");
      setAbierto(false);
    });
  }

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="mb-6 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
      >
        + Nueva historia clínica
      </button>
    );
  }

  return (
    <div className="mb-6 rounded-xl bg-white p-5 ring-1 ring-zinc-200">
      <label className="mb-1 block text-xs font-medium text-zinc-600">
        Tipo de historia
      </label>
      <select
        value={tipoId}
        onChange={(e) => {
          setTipoId(e.target.value);
          setValores({});
        }}
        className={`${input} mb-4`}
      >
        <option value="">Selecciona…</option>
        {tipos.map((t) => (
          <option key={t.id} value={t.id}>
            {t.nombre}
          </option>
        ))}
      </select>

      {tipo && (
        <div className="space-y-3">
          {tipo.campos_historia.map((c) => (
            <div key={c.id}>
              <label className="mb-1 block text-xs font-medium text-zinc-600">
                {c.etiqueta} {c.requerido && <span className="text-red-500">*</span>}
              </label>
              {c.tipo_dato === "booleano" ? (
                <label className="flex items-center gap-2 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    checked={Boolean(valores[c.id])}
                    onChange={(e) => setCampo(c.id, e.target.checked)}
                  />
                  Sí
                </label>
              ) : c.tipo_dato === "opciones" ? (
                <select
                  className={input}
                  value={String(valores[c.id] ?? "")}
                  onChange={(e) => setCampo(c.id, e.target.value)}
                >
                  <option value="">—</option>
                  {(c.opciones ?? []).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className={input}
                  type={
                    c.tipo_dato === "numero"
                      ? "number"
                      : c.tipo_dato === "fecha"
                        ? "date"
                        : "text"
                  }
                  value={String(valores[c.id] ?? "")}
                  onChange={(e) =>
                    setCampo(
                      c.id,
                      c.tipo_dato === "numero"
                        ? Number(e.target.value)
                        : e.target.value,
                    )
                  }
                />
              )}
            </div>
          ))}
        </div>
      )}

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
          {pending ? "Guardando…" : "Guardar historia"}
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
