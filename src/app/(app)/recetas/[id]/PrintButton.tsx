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
    if (!contenidoCabeEnArea({
      contenidoInferior: contenido.getBoundingClientRect().bottom,
      limiteSuperior: limite.getBoundingClientRect().top,
    })) {
      setError("La receta es demasiado larga para media carta. Acorta las indicaciones o divídela antes de imprimir.");
      return;
    }
    setError("");
    window.print();
  }

  return (
    <div className="flex max-w-md flex-col items-end gap-2">
      <button type="button" onClick={imprimir} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">
        Imprimir
      </button>
      {error ? <p role="alert" className="text-right text-sm font-medium text-red-700">{error}</p> : null}
      {/* Mismos ajustes con los que imprimía el POS viejo desde Acrobat: hoja
          carta completa, a tamaño real, y la hoja se corta a la mitad. */}
      <p className="text-right text-xs leading-relaxed text-zinc-500">
        En el cuadro de impresión: papel <strong>Carta (215.9 × 279.4 mm)</strong>, orientación <strong>vertical</strong>,
        escala <strong>100%</strong> (nunca &ldquo;ajustar&rdquo;), márgenes <strong>ninguno</strong>.
        <br />
        La receta sale en la mitad de arriba de la hoja. Se corta como siempre.
      </p>
    </div>
  );
}
