"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

// Código de barras del folio de la receta. El valor lleva el prefijo "REC"
// para que el POS de farmacia distinga una receta de un código de producto al
// escanear y jale automáticamente los medicamentos recetados.
export default function CodigoBarrasReceta({ folio }: { folio: number }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    try {
      JsBarcode(ref.current, `REC${folio}`, {
        format: "CODE128",
        displayValue: true,
        fontSize: 11,
        height: 38,
        margin: 0,
        background: "transparent",
      });
    } catch {
      // Si el folio aún no existe, no renderiza (no rompe la impresión).
    }
  }, [folio]);

  return <svg ref={ref} aria-label={`Código de receta REC${folio}`} />;
}
