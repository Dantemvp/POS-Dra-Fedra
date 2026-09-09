"use client";

import { useState } from "react";
import { planificarPaginas } from "@/lib/paginacion-documento";

// Carta en puntos
const PAGE_W = 612;
const PAGE_H = 792;
// Márgenes de cada hoja (deja respirar las esquinas decorativas del membrete)
const MARGIN_X = 44;
const MARGIN_TOP = 44;
const MARGIN_BOTTOM = 48;
const CONTENT_W = PAGE_W - MARGIN_X * 2; // 524
const CONTENT_H = PAGE_H - MARGIN_TOP - MARGIN_BOTTOM; // 700

function cargarImagen(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Genera un PDF carta MULTIPÁGINA: cada hoja lleva el membrete completo y
// alineado + márgenes, y una porción del contenido. Así nunca se corta ni
// se desalinea el membrete.
export default function PrintButton({ filename = "historia-clinica" }: { filename?: string }) {
  const [trabajando, setTrabajando] = useState<"" | "pdf" | "print">("");

  async function generar(): Promise<{ blobUrl: string; save: () => void } | null> {
    const body = document.querySelector(".hc-body") as HTMLElement | null;
    if (!body) return null;

    const [{ default: html2canvas }, { jsPDF }, membrete] = await Promise.all([
      import("html2canvas-pro"),
      import("jspdf"),
      cargarImagen("/membrete-historia.png"),
    ]);

    // Captura SOLO el contenido (sin el membrete de fondo)
    const canvas = await html2canvas(body, {
      scale: 2,
      backgroundColor: null, // transparente: el membrete va detrás en el PDF
      useCORS: true,
      logging: false,
    });

    // Escala: el ancho capturado mapea a CONTENT_W puntos
    const pxPerPt = canvas.width / CONTENT_W; // px de canvas por punto
    const sliceHpx = CONTENT_H * pxPerPt; // alto de cada página en px de canvas
    const bodyRect = body.getBoundingClientRect();
    const escalaCaptura = bodyRect.height > 0 ? canvas.height / bodyRect.height : 1;
    const rangosProtegidos = Array.from(
      body.querySelectorAll<HTMLElement>("[data-pdf-block]"),
    ).map((elemento) => {
      const rect = elemento.getBoundingClientRect();
      return {
        inicio: (rect.top - bodyRect.top) * escalaCaptura,
        fin: (rect.bottom - bodyRect.top) * escalaCaptura,
      };
    });
    const paginas = planificarPaginas(canvas.height, sliceHpx, rangosProtegidos);

    const pdf = new jsPDF({ unit: "pt", format: "letter" });

    for (let p = 0; p < paginas.length; p++) {
      if (p > 0) pdf.addPage();
      // 1) Membrete completo de la hoja
      pdf.addImage(membrete, "PNG", 0, 0, PAGE_W, PAGE_H);
      // 2) Porción del contenido recortada a una hoja
      const { inicio: sy, alto: hpx } = paginas[p];
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = hpx;
      const ctx = slice.getContext("2d");
      if (!ctx) continue;
      ctx.drawImage(canvas, 0, sy, canvas.width, hpx, 0, 0, canvas.width, hpx);
      const hpt = hpx / pxPerPt;
      pdf.addImage(
        slice.toDataURL("image/png"),
        "PNG",
        MARGIN_X,
        MARGIN_TOP,
        CONTENT_W,
        hpt,
      );
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
