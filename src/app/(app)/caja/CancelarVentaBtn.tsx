"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelarVenta } from "./actions";

export default function CancelarVentaBtn({ ventaId }: { ventaId: string }) {
  const router = useRouter();
  const [confirmar, setConfirmar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function cancelar() {
    setError(null);
    startTransition(async () => {
      const res = await cancelarVenta(ventaId);
      if (!res.ok) {
        setError(res.error ?? "Error.");
        setConfirmar(false);
        return;
      }
      router.refresh();
    });
  }

  if (error)
    return <span className="text-xs text-red-600">{error}</span>;

  if (!confirmar)
    return (
      <button
        onClick={() => setConfirmar(true)}
        className="text-xs font-medium text-red-600 hover:underline"
      >
        Cancelar
      </button>
    );

  return (
    <span className="flex items-center justify-end gap-1">
      <button
        onClick={cancelar}
        disabled={pending}
        className="rounded bg-red-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
      >
        {pending ? "…" : "Sí, devolver"}
      </button>
      <button
        onClick={() => setConfirmar(false)}
        className="rounded px-1.5 py-0.5 text-xs text-zinc-500 hover:bg-zinc-100"
      >
        No
      </button>
    </span>
  );
}
