"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelarCobro } from "./actions";

export default function CancelarCobro({ id }: { id: string }) {
  const router = useRouter();
  const [confirmar, setConfirmar] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function cancelar() {
    setError("");
    start(async () => {
      const r = await cancelarCobro(id);
      if (!r.ok) {
        setError(r.error ?? "No se pudo cancelar.");
        return;
      }
      router.refresh();
    });
  }

  if (!confirmar) {
    return (
      <button
        onClick={() => setConfirmar(true)}
        className="text-xs font-medium text-amber-700 hover:text-amber-900"
      >
        Cancelar
      </button>
    );
  }
  return (
    <div className="flex items-center justify-end gap-2">
      <button
        onClick={cancelar}
        disabled={pending}
        className="rounded bg-amber-600 px-2 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
      >
        {pending ? "…" : "Confirmar cancelación"}
      </button>
      <button
        onClick={() => {
          setConfirmar(false);
          setError("");
        }}
        className="text-xs text-zinc-500 hover:text-zinc-800"
      >
        No
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
