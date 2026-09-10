"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

// Código de barras del folio de la receta. El valor lleva el prefijo "REC"
// para que el POS de farmacia distinga una receta de un código de producto al
// escanear y jale automáticamente los medicamentos recetados.
export default function CodigoBarrasReceta({ folio }: { folio: number }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    try {
      JsBarcode(svg, `REC${folio}`, {
        format: "CODE128",
        displayValue: true,
        fontSize: 11,
        height: 38,
        margin: 0,
        background: "transparent",
      });

      // JsBarcode fija width/height en píxeles sobre el <svg>. Sin viewBox, el
      // dibujo conserva ese tamaño aunque el contenedor sea más chico: por eso
      // se salía de la hoja al imprimir en media carta. Se convierte la medida
      // generada en viewBox y se dejan las dimensiones al CSS, de modo que el
      // código siempre quepa dentro del área que se le asigna.
      const w = svg.getAttribute("width");
      const h = svg.getAttribute("height");
      if (w && h) {
        svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
        svg.setAttribute("preserveAspectRatio", "xMinYMid meet");
        svg.removeAttribute("width");
        svg.removeAttribute("height");
      }
    } catch {
      // Si el folio aún no existe, no renderiza (no rompe la impresión).
    }
  }, [folio]);

  return (
    <svg
      ref={ref}
      aria-label={`Código de receta REC${folio}`}
      style={{ display: "block", width: "100%", height: "auto" }}
    />
  );
}
