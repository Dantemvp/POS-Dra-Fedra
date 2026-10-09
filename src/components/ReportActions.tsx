"use client";

export default function ReportActions({ filas, nombre }: { filas: (string | number)[][]; nombre: string }) {
  function exportar() {
    const csv = filas.map(fila => fila.map(valor => {
      let texto = String(valor);
      if (typeof valor === "string" && /^[=+@\-]/.test(texto)) texto = "'" + texto;
      return '"' + texto.replaceAll('"','""') + '"';
    }).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const enlace = document.createElement("a");
    enlace.href = url; enlace.download = nombre + ".csv"; enlace.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="flex flex-wrap gap-2 print:hidden">
    <button onClick={() => window.print()} className="rounded-lg bg-zinc-900 px-4 py-2 font-semibold text-white">Imprimir / PDF</button>
    <button onClick={exportar} className="rounded-lg border border-zinc-300 px-4 py-2 font-semibold">Exportar Excel (CSV)</button>
  </div>;
}
