"use client";

export type FilaLibro = {
  producto: string;
  fraccion: string;
  entradas: number;
  salidas: number;
  existencia: number;
};

export default function ExportLibro({ filas }: { filas: FilaLibro[] }) {
  function exportar() {
    const encabezado = "Producto,Fraccion,Entradas,Salidas,Existencia\n";
    const cuerpo = filas
      .map(
        (f) =>
          `"${f.producto}",${f.fraccion},${f.entradas},${f.salidas},${f.existencia}`,
      )
      .join("\n");
    const csv = encabezado + cuerpo;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `libro-control-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={exportar}
      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
    >
      Exportar CSV
    </button>
  );
}
