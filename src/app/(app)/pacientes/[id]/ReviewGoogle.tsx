"use client";

import { useState, useTransition } from "react";
import { marcarReviewGoogle } from "../actions";

// Botón para marcar si el paciente ya nos dejó reseña en Google Maps.
export default function ReviewGoogle({
  pacienteId,
  inicial,
}: {
  pacienteId: string;
  inicial: boolean;
}) {
  const [tiene, setTiene] = useState(inicial);
  const [pending, start] = useTransition();

  function toggle() {
    const nuevo = !tiene;
    setTiene(nuevo); // optimista
    start(async () => {
      const r = await marcarReviewGoogle(pacienteId, nuevo);
      if (!r.ok) setTiene(!nuevo); // revertir si falla
    });
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      title="Marca si el paciente ya dejó reseña en Google Maps"
      className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium ring-1 transition disabled:opacity-60 ${
        tiene
          ? "bg-amber-50 text-amber-700 ring-amber-200 hover:bg-amber-100"
          : "bg-white text-zinc-500 ring-zinc-200 hover:bg-zinc-50"
      }`}
    >
      {tiene ? "★ Reseña Google ✓" : "☆ ¿Reseña Google?"}
    </button>
  );
}
