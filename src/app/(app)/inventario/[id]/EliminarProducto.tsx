"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { eliminarProducto } from "../actions";

export default function EliminarProducto({
  productoId,
  nombre,
}: {
  productoId: string;
  nombre: string;
}) {
  const router = useRouter();
  const [confirmar, setConfirmar] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function borrar() {
    setError("");
    start(async () => {
      const r = await eliminarProducto(productoId);
      if (!r.ok) {
        setError(r.error ?? "No se pudo eliminar.");
        return;
      }
      // Aviso de archivado (ok pero con mensaje)
      if (r.error) {
        setError(r.error);
        setTimeout(() => router.push("/inventario"), 1500);
        return;
      }
      router.push("/inventario");
      router.refresh();
    });
  }

  if (!confirmar) {
    return (
      <button
        onClick={() => setConfirmar(true)}
        className="text-sm font-medium text-red-600 hover:text-red-800"
      >
        Eliminar producto
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-3">
      <p className="text-sm text-red-800">
        ¿Eliminar <strong>{nombre}</strong>? Si tiene ventas registradas se
        archivará en vez de borrarse.
      </p>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button
          onClick={borrar}
          disabled={pending}
          className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {pending ? "Eliminando…" : "Sí, eliminar"}
        </button>
        <button
          onClick={() => {
            setConfirmar(false);
            setError("");
          }}
          className="rounded-lg px-3 py-1.5 text-sm text-zinc-600 hover:text-zinc-900"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
