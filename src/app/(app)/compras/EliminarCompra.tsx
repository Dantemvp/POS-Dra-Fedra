"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { eliminarCompra } from "./actions";

export default function EliminarCompra({ id }: { id: string }) {
  const router = useRouter();
  const [confirmar, setConfirmar] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function borrar() {
    setError("");
    start(async () => {
      const r = await eliminarCompra(id);
      if (!r.ok) {
        setError(r.error ?? "No se pudo eliminar.");
        return;
      }
      router.refresh();
    });
  }

  if (!confirmar) {
    return (
      <button
        onClick={() => setConfirmar(true)}
        className="text-xs font-medium text-red-600 hover:text-red-800"
      >
        Eliminar
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-2">
      <button
        onClick={borrar}
        disabled={pending}
        className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
      >
        {pending ? "…" : "Confirmar"}
      </button>
      <button
        onClick={() => {
          setConfirmar(false);
          setError("");
        }}
        className="text-xs text-zinc-500 hover:text-zinc-800"
      >
        Cancelar
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
