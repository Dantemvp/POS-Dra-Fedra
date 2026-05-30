"use client";

import { useState, useTransition } from "react";
import { registrarCorte } from "./actions";

export default function CorteButton({
  totalVentas,
  totalEfectivo,
}: {
  totalVentas: number;
  totalEfectivo: number;
}) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function hacerCorte() {
    setMsg(null);
    startTransition(async () => {
      const res = await registrarCorte(totalVentas, totalEfectivo);
      setMsg(res.ok ? "Corte registrado." : res.error ?? "Error.");
    });
  }

  return (
    <div className="flex items-center gap-3">
      {msg && <span className="text-sm text-zinc-500">{msg}</span>}
      <button
        onClick={hacerCorte}
        disabled={pending}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50"
      >
        {pending ? "Registrando…" : "Cerrar corte de caja"}
      </button>
    </div>
  );
}
