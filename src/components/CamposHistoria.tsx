"use client";

import { aplicaPorSexo, campoVisible, campoVisibleEnEdicion, elegirOpcionMultiple, NO_APLICA, type CampoHistoria } from "@/lib/historia-campos";

export default function CamposHistoria({ campos, valores, sexo, onChange, prefijo = "hc", disabled = false, originales, mostrarSeccion = true }: {
  campos: CampoHistoria[];
  valores: Record<string, unknown>;
  sexo: "F" | "M" | null;
  onChange: (id: string, valor: unknown) => void;
  prefijo?: string;
  disabled?: boolean;
  originales?: Record<string, unknown>;
  mostrarSeccion?: boolean;
}) {
  const grupos = new Map<string, CampoHistoria[]>();
  for (const c of campos) {
    if (!c.oculto) grupos.set(c.seccion ?? "Datos", [...(grupos.get(c.seccion ?? "Datos") ?? []), c]);
  }
  const input = "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 disabled:opacity-60";
  return <div className="space-y-4">{[...grupos].map(([seccion, todos]) => {
    const visibles = todos.filter(c => originales ? campoVisibleEnEdicion(c, valores, sexo, originales) : campoVisible(c, valores, sexo));
    const noAplica = !visibles.length && todos.every(c => !aplicaPorSexo(c, sexo));
    if (!visibles.length && !noAplica) return null;
    return <fieldset key={seccion} disabled={disabled} className="min-w-0 space-y-3">
      <legend className={mostrarSeccion ? "mb-3 w-full border-b border-zinc-200 pb-2 text-sm font-semibold text-zinc-700" : "sr-only"}>{seccion}</legend>
      {noAplica ? <p className="text-sm text-zinc-500">{NO_APLICA}</p> : visibles.map(c => {
        const id = `${prefijo}-${c.id}`;
        const etiqueta = `${c.etiqueta}${c.requerido ? " *" : ""}`;
        const v = valores[c.id];
        if (c.tipo_dato === "booleano") return <fieldset key={c.id} className="min-w-0">
          <legend className="mb-1 text-sm text-zinc-700">{etiqueta}</legend>
          <div className="grid grid-cols-3 gap-2">{[[true,"Sí"],[false,"No"],[null,"Sin responder"]].map(([valor, texto]) => {
            const activo = valor === null ? v == null : v === valor;
            return <button key={String(texto)} type="button" aria-pressed={activo} onClick={() => onChange(c.id, valor)} className={`min-h-11 rounded-lg border px-2 py-2 text-sm ${activo ? "border-stone-500 bg-stone-100 text-stone-800" : "border-zinc-200 bg-white text-zinc-600"}`}>{String(texto)}</button>;
          })}</div>
          {c.etiqueta === "¿Toma algún medicamento actualmente?" && v !== true && <p className="mt-1 text-xs text-zinc-500">Al elegir Sí puedes escribir cuáles y sus dosis.</p>}
        </fieldset>;
        if (c.tipo_dato === "multi") {
          const arr = Array.isArray(v) ? v as string[] : [];
          return <fieldset key={c.id} className="min-w-0"><legend className="mb-1 text-sm text-zinc-700">{etiqueta}</legend>
            {typeof v === "string" && v.trim() && <p className="mb-2 rounded-lg bg-stone-50 p-2 text-sm">Respuesta anterior: {v}. Se conserva si no eliges casillas.</p>}
            <div className="flex flex-wrap gap-x-4 gap-y-1">{(c.opciones ?? []).map(opcion => <label key={opcion} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-zinc-700">
              <input type="checkbox" checked={arr.includes(opcion)} onChange={e => onChange(c.id, elegirOpcionMultiple(arr, opcion, e.target.checked))} />{opcion}
            </label>)}</div>
          </fieldset>;
        }
        return <div key={c.id}><label htmlFor={id} className="mb-1 block text-sm text-zinc-700">{etiqueta}{c.rol === "imc" ? " (automático)" : ""}</label>
          {c.tipo_dato === "textarea" ? <textarea id={id} rows={3} maxLength={5000} className={input} value={String(v ?? "")} onChange={e => onChange(c.id, e.target.value)} />
            : c.tipo_dato === "opciones" ? <select id={id} className={input} value={String(v ?? "")} onChange={e => onChange(c.id, e.target.value)}><option value="">Sin responder</option>{[...new Set([...(typeof v === "string" && v ? [v] : []), ...(c.opciones ?? [])])].map(opcion => <option key={opcion} value={opcion}>{opcion}</option>)}</select>
              : <input id={id} className={input} type={c.tipo_dato === "numero" ? "number" : c.tipo_dato === "fecha" ? "date" : "text"} step={c.tipo_dato === "numero" ? "any" : undefined} maxLength={1000} value={String(v ?? "")} onChange={e => onChange(c.id, c.tipo_dato === "numero" && e.target.value !== "" ? Number(e.target.value) : e.target.value)} />}
        </div>;
      })}
    </fieldset>;
  })}</div>;
}
