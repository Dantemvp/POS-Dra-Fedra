"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { actualizarHistoria, eliminarHistoria } from "../actions";

type Def = { tipo_dato: string; opciones: string[] | null };

export default function HistoriaCard({
  historiaId,
  pacienteId,
  titulo,
  fecha,
  datos,
  labels,
  defs = {},
  esAdmin,
}: {
  historiaId: string;
  pacienteId: string;
  titulo: string;
  fecha: string;
  datos: Record<string, unknown>;
  labels: Record<string, string>;
  defs?: Record<string, Def>;
  esAdmin: boolean;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [valores, setValores] = useState<Record<string, unknown>>(datos);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function borrar() {
    setError(null);
    startTransition(async () => {
      const res = await eliminarHistoria(historiaId, pacienteId);
      if (!res.ok) {
        setError(res.error ?? "Error al eliminar.");
        setConfirmar(false);
        return;
      }
      router.refresh();
    });
  }

  const entradas = Object.entries(datos);

  function guardar() {
    setError(null);
    startTransition(async () => {
      const res = await actualizarHistoria(historiaId, valores, pacienteId);
      if (!res.ok) {
        setError(res.error ?? "Error al guardar.");
        return;
      }
      setEditando(false);
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl bg-white p-5 ring-1 ring-zinc-200">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium text-zinc-900">{titulo}</span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-400">{fecha}</span>
          {!editando ? (
            <div className="flex items-center gap-1">
              <Link
                href={`/pacientes/historia/${historiaId}`}
                className="rounded-lg px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
              >
                Imprimir con membrete
              </Link>
              <button
                onClick={() => {
                  setValores(datos);
                  setEditando(true);
                }}
                className="rounded-lg px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
              >
                Editar
              </button>
              {esAdmin && !confirmar && (
                <button
                  onClick={() => setConfirmar(true)}
                  className="rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  Eliminar
                </button>
              )}
              {esAdmin && confirmar && (
                <span className="flex items-center gap-1">
                  <button
                    onClick={borrar}
                    disabled={pending}
                    className="rounded-lg bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {pending ? "Eliminando…" : "Sí, eliminar"}
                  </button>
                  <button
                    onClick={() => setConfirmar(false)}
                    className="rounded-lg px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100"
                  >
                    No
                  </button>
                </span>
              )}
            </div>
          ) : (
            <div className="flex gap-1">
              <button
                onClick={guardar}
                disabled={pending}
                className="rounded-lg bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                {pending ? "Guardando…" : "Guardar"}
              </button>
              <button
                onClick={() => {
                  setEditando(false);
                  setError(null);
                }}
                className="rounded-lg px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {!editando ? (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {entradas.map(([k, v]) => (
            <div
              key={k}
              className="flex justify-between gap-2 border-b border-zinc-50 py-1"
            >
              <dt className="text-zinc-500">{labels[k] ?? k}</dt>
              <dd className="text-right font-medium text-zinc-800">
                {typeof v === "boolean"
                  ? v
                    ? "Sí"
                    : "No"
                  : Array.isArray(v)
                    ? v.length
                      ? v.join(", ")
                      : "—"
                    : String(v || "—")}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {entradas.map(([k, v]) => {
            const def = defs[k];
            const tipo =
              def?.tipo_dato ?? (typeof v === "boolean" ? "booleano" : "texto");
            const inputCls =
              "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900";
            return (
              <div key={k}>
                <label className="mb-1 block text-xs font-medium text-zinc-600">
                  {labels[k] ?? k}
                </label>
                {tipo === "booleano" ? (
                  <label className="flex items-center gap-2 text-sm text-zinc-700">
                    <input
                      type="checkbox"
                      checked={Boolean(valores[k])}
                      onChange={(e) =>
                        setValores((p) => ({ ...p, [k]: e.target.checked }))
                      }
                    />
                    Sí
                  </label>
                ) : tipo === "multi" ? (
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                    {(def?.opciones ?? []).map((o) => {
                      const arr = Array.isArray(valores[k])
                        ? (valores[k] as string[])
                        : [];
                      return (
                        <label
                          key={o}
                          className="flex items-center gap-1.5 text-sm text-zinc-700"
                        >
                          <input
                            type="checkbox"
                            checked={arr.includes(o)}
                            onChange={(e) =>
                              setValores((p) => ({
                                ...p,
                                [k]: e.target.checked
                                  ? [...arr, o]
                                  : arr.filter((x) => x !== o),
                              }))
                            }
                          />
                          {o}
                        </label>
                      );
                    })}
                  </div>
                ) : tipo === "opciones" ? (
                  <select
                    className={inputCls}
                    value={String(valores[k] ?? "")}
                    onChange={(e) =>
                      setValores((p) => ({ ...p, [k]: e.target.value }))
                    }
                  >
                    <option value="">—</option>
                    {(def?.opciones ?? []).map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : tipo === "textarea" ? (
                  <textarea
                    rows={3}
                    className={`${inputCls} min-h-20`}
                    value={String(valores[k] ?? "")}
                    onChange={(e) =>
                      setValores((p) => ({ ...p, [k]: e.target.value }))
                    }
                  />
                ) : (
                  <input
                    type={
                      tipo === "numero" ? "number" : tipo === "fecha" ? "date" : "text"
                    }
                    value={String(valores[k] ?? "")}
                    onChange={(e) =>
                      setValores((p) => ({
                        ...p,
                        [k]:
                          tipo === "numero"
                            ? Number(e.target.value)
                            : e.target.value,
                      }))
                    }
                    className={inputCls}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
