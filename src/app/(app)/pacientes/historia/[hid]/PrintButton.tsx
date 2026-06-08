"use client";

import { useState } from "react";

// Genera un PDF tamaño carta capturando EXACTAMENTE el documento de la preview
// (.hc-doc) — así lo impreso es idéntico a lo que se ve en pantalla.
export default function PrintButton({ filename = "historia-clinica" }: { filename?: string }) {
  const [trabajando, setTrabajando] = useState<"" | "pdf" | "print">("");

  async function generar(): Promise<{ blobUrl: string; save: () => void } | null> {
    const el = document.querySelector(".hc-doc") as HTMLElement | null;
    if (!el) return null;
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import("html2canvas-pro"),
      import("jspdf"),
    ]);
    const canvas = await html2canvas(el, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
    });
    const img = canvas.toDataURL("image/jpeg", 0.95);

    // Carta en puntos: 612 x 792. La imagen se ajusta al ancho y se pagina.
    const pdf = new jsPDF({ unit: "pt", format: "letter" });
    const pageW = 612;
    const pageH = 792;
    const imgH = (canvas.height * pageW) / canvas.width;
    let heightLeft = imgH;
    let position = 0;
    pdf.addImage(img, "JPEG", 0, position, pageW, imgH);
    heightLeft -= pageH;
    while (heightLeft > 0) {
      position -= pageH;
      pdf.addPage();
      pdf.addImage(img, "JPEG", 0, position, pageW, imgH);
      heightLeft -= pageH;
    }
    return {
      blobUrl: pdf.output("bloburl") as unknown as string,
      save: () => pdf.save(`${filename}.pdf`),
    };
  }

  async function descargar() {
    setTrabajando("pdf");
    try {
      const r = await generar();
      r?.save();
    } finally {
      setTrabajando("");
    }
  }

  async function imprimir() {
    setTrabajando("print");
    try {
      const r = await generar();
      if (r) window.open(r.blobUrl, "_blank");
    } finally {
      setTrabajando("");
    }
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={descargar}
        disabled={!!trabajando}
        className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
      >
        {trabajando === "pdf" ? "Generando…" : "Descargar PDF"}
      </button>
      <button
        onClick={imprimir}
        disabled={!!trabajando}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {trabajando === "print" ? "Generando…" : "Imprimir"}
      </button>
    </div>
  );
}
