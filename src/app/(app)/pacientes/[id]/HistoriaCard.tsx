"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { actualizarHistoria, eliminarHistoria } from "../actions";

export default function HistoriaCard({
  historiaId,
  pacienteId,
  titulo,
  fecha,
  datos,
  labels,
  esAdmin,
}: {
  historiaId: string;
  pacienteId: string;
  titulo: string;
  fecha: string;
  datos: Record<string, unknown>;
  labels: Record<string, string>;
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
                {typeof v === "boolean" ? (v ? "Sí" : "No") : String(v || "—")}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {entradas.map(([k, v]) => (
            <div key={k}>
              <label className="mb-1 block text-xs font-medium text-zinc-600">
                {labels[k] ?? k}
              </label>
              {typeof v === "boolean" ? (
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
              ) : (
                <input
                  value={String(valores[k] ?? "")}
                  onChange={(e) =>
                    setValores((p) => ({ ...p, [k]: e.target.value }))
                  }
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
