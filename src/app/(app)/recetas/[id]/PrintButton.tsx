"use client";

import { useState } from "react";
import { contenidoCabeEnArea } from "@/lib/impresion-documento";

export default function PrintButton() {
  const [error, setError] = useState("");

  function imprimir() {
    const contenido = document.querySelector<HTMLElement>("[data-receta-contenido]");
    const limite = document.querySelector<HTMLElement>("[data-receta-limite]");
    if (!contenido || !limite) {
      setError("No se pudo verificar el área imprimible. No se imprimió la receta.");
      return;
    }

    const contenidoRect = contenido.getBoundingClientRect();
    const limiteRect = limite.getBoundingClientRect();
    if (
      !contenidoCabeEnArea({
        contenidoInferior: contenidoRect.bottom,
        limiteSuperior: limiteRect.top,
      })
    ) {
      setError(
        "La receta es demasiado larga para media carta. Acorta las indicaciones o divídela antes de imprimir.",
      );
      return;
    }

    setError("");
    window.print();
  }

  return (
    <div className="flex max-w-md flex-col items-end gap-2">
      <button
        onClick={imprimir}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
      >
        Imprimir
      </button>
      {error ? (
        <p role="alert" className="text-right text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
