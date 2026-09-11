"use client";

// Marca visible de los registros que llegaron del AppSheet viejo, y el selector
// que deja verlos aparte de lo que se captura en este POS.
//
// Un registro histórico se muestra igual que cualquier otro: no se esconde ni se
// corrige. La etiqueta sólo dice de dónde vino.

export type VistaHistorico = "todos" | "actual" | "historico";

export function BadgeHistorico({ compacto = false }: { compacto?: boolean }) {
  return (
    <span
      title="Información histórica importada"
      className="inline-flex shrink-0 items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200"
    >
      {compacto ? "Histórico" : "Información histórica importada"}
    </span>
  );
}

export function SelectorHistorico({
  valor,
  onChange,
  etiquetaActual = "Sólo actuales",
}: {
  valor: VistaHistorico;
  onChange: (v: VistaHistorico) => void;
  etiquetaActual?: string;
}) {
  return (
    <select
      value={valor}
      onChange={(e) => onChange(e.target.value as VistaHistorico)}
      aria-label="Procedencia de los datos"
      className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700"
    >
      <option value="todos">Todos los registros</option>
      <option value="actual">{etiquetaActual}</option>
      <option value="historico">Sólo históricos</option>
    </select>
  );
}

// Filtro que usan todas las listas, para que el criterio sea el mismo en todas.
export function coincideVista(
  esHistorico: boolean | null | undefined,
  vista: VistaHistorico,
): boolean {
  if (vista === "todos") return true;
  if (vista === "historico") return esHistorico === true;
  return esHistorico !== true;
}

// Texto que se suma a la búsqueda, para que escribir "histórico" encuentre estos
// registros sin tener que tocar el selector.
export function textoBusqueda(esHistorico: boolean | null | undefined): string {
  return esHistorico ? " histórico historica información histórica importada" : "";
}
