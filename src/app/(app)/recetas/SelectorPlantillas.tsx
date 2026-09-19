"use client";

import { useMemo, useState } from "react";
import {
  categoriasDe,
  type PlantillaReceta,
} from "./plantillas";

export default function SelectorPlantillas({
  plantillas,
  onAplicar,
  categoriaSugerida,
}: {
  plantillas: PlantillaReceta[];
  onAplicar: (plantilla: PlantillaReceta) => void;
  categoriaSugerida?: string | null;
}) {
  const categorias = useMemo(() => categoriasDe(plantillas), [plantillas]);
  const [abierto, setAbierto] = useState(false);
  const [categoria, setCategoria] = useState(
    () => (categoriaSugerida && categorias.includes(categoriaSugerida) ? categoriaSugerida : categorias[0]) ?? "",
  );

  const visibles = plantillas.filter((p) => p.categoria === categoria);

  if (plantillas.length === 0) return null;

  return (
    <div className="mb-4 rounded-xl border border-zinc-200 bg-stone-50 p-3 no-print">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center justify-between text-sm font-medium text-zinc-800"
      >
        <span>Usar una combinación de la doctora</span>
        <span className="text-zinc-400">{abierto ? "Cerrar" : `${plantillas.length} plantillas`}</span>
      </button>

      {abierto && (
        <div className="mt-3">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Fases">
            {categorias.map((c) => (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={c === categoria}
                onClick={() => setCategoria(c)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                  c === categoria
                    ? "border-[#8c7a63] bg-[#f1ebe1] text-[#6f604e]"
                    : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <ul className="mt-3 space-y-1.5">
            {visibles.map((p) => {
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onAplicar(p);
                      setAbierto(false);
                    }}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-left transition-colors hover:border-[#8c7a63] hover:bg-[#faf7f2]"
                  >
                    <span className="block text-sm font-medium text-zinc-900">{p.nombre}</span>
                    <span className="mt-0.5 block text-xs text-zinc-500">
                      {p.items.length} medicamento{p.items.length === 1 ? "" : "s"}
                      {p.items.length > 0 && `: ${p.items.map((i) => i.medicamento).join(", ")}`}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5">
                      {p.fase_texto && (
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-600">
                          Imprime &ldquo;{p.fase_texto}&rdquo;
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <p className="mt-2 text-xs text-zinc-500">
            Al elegir una, se reemplazan los medicamentos que tengas capturados.
          </p>
        </div>
      )}
    </div>
  );
}
