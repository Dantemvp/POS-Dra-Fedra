"use client";

import { useMemo, useState } from "react";
import CodigoBarrasReceta from "./CodigoBarrasReceta";
import PrintButton from "./PrintButton";

export type ItemImprimible = {
  medicamento: string;
  dosis: string | null;
  duracion_dias: number | null;
  indicaciones: string | null;
};

type ItemEditable = ItemImprimible & { id: number };

type Props = {
  nombre: string;
  edad: string;
  fecha: string;
  folio: number;
  fase: number | null;
  items: ItemImprimible[];
};

function prepararItems(items: ItemImprimible[]): ItemEditable[] {
  return items.map((item, id) => ({ ...item, id }));
}

export default function AjustadorReceta({ nombre, edad, fecha, folio, fase: faseInicial, items: itemsIniciales }: Props) {
  const originales = useMemo(() => prepararItems(itemsIniciales), [itemsIniciales]);
  const [editando, setEditando] = useState(false);
  const [items, setItems] = useState<ItemEditable[]>(originales);
  const [fase, setFase] = useState(faseInicial?.toString() ?? "");
  const [tamano, setTamano] = useState(1.5);
  const [separacion, setSeparacion] = useState(1.5);
  const [izquierda, setIzquierda] = useState(5);
  const [inicio, setInicio] = useState(28);
  const [siguienteId, setSiguienteId] = useState(itemsIniciales.length);

  function actualizar(id: number, campo: keyof ItemImprimible, valor: string) {
    setItems((actuales) => actuales.map((item) => item.id === id
      ? { ...item, [campo]: campo === "duracion_dias" ? (valor ? Number(valor) : null) : valor }
      : item));
  }

  function mover(indice: number, direccion: -1 | 1) {
    const destino = indice + direccion;
    if (destino < 0 || destino >= items.length) return;
    setItems((actuales) => {
      const copia = [...actuales];
      [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
      return copia;
    });
  }

  function agregar() {
    setItems((actuales) => [...actuales, {
      id: siguienteId,
      medicamento: "",
      dosis: "",
      duracion_dias: null,
      indicaciones: "",
    }]);
    setSiguienteId((id) => id + 1);
  }

  function restablecer() {
    setItems(originales);
    setFase(faseInicial?.toString() ?? "");
    setTamano(1.5);
    setSeparacion(1.5);
    setIzquierda(5);
    setInicio(28);
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-end gap-2 no-print">
        <button
          type="button"
          onClick={() => setEditando((valor) => !valor)}
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
        >
          {editando ? "Cerrar ajustes" : "Ajustar antes de imprimir"}
        </button>
        <PrintButton />
      </div>

      {editando ? (
        <section className="mb-5 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm no-print">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-zinc-900">Ajustes de esta impresión</h2>
              <p className="text-sm text-zinc-500">No cambia la receta guardada. La fase siempre cierra el texto impreso.</p>
            </div>
            <button type="button" onClick={restablecer} className="text-sm font-medium text-zinc-600 underline">
              Restablecer
            </button>
          </div>

          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="text-sm text-zinc-700">Fase
              <input value={fase} onChange={(e) => setFase(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2" />
            </label>
            <label className="text-sm text-zinc-700">Texto {tamano.toFixed(1)}
              <input type="range" min="1.2" max="1.7" step="0.1" value={tamano} onChange={(e) => setTamano(Number(e.target.value))} className="mt-3 w-full" />
            </label>
            <label className="text-sm text-zinc-700">Separación {separacion.toFixed(1)}
              <input type="range" min="0.6" max="2" step="0.1" value={separacion} onChange={(e) => setSeparacion(Number(e.target.value))} className="mt-3 w-full" />
            </label>
            <label className="text-sm text-zinc-700">Mover horizontal
              <input type="range" min="3" max="10" step="0.5" value={izquierda} onChange={(e) => setIzquierda(Number(e.target.value))} className="mt-3 w-full" />
            </label>
            <label className="text-sm text-zinc-700">Mover vertical
              <input type="range" min="25" max="36" step="0.5" value={inicio} onChange={(e) => setInicio(Number(e.target.value))} className="mt-3 w-full" />
            </label>
          </div>

          <div className="space-y-3">
            {items.map((item, indice) => (
              <div key={item.id} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Medicamento {indice + 1}</span>
                  <div className="flex gap-1">
                    <button type="button" disabled={indice === 0} onClick={() => mover(indice, -1)} className="rounded border px-2 py-1 disabled:opacity-30" aria-label="Subir medicamento">↑</button>
                    <button type="button" disabled={indice === items.length - 1} onClick={() => mover(indice, 1)} className="rounded border px-2 py-1 disabled:opacity-30" aria-label="Bajar medicamento">↓</button>
                    <button type="button" onClick={() => setItems((actuales) => actuales.filter((actual) => actual.id !== item.id))} className="rounded border border-red-200 px-2 py-1 text-red-700" aria-label="Quitar de esta impresión">Quitar</button>
                  </div>
                </div>
                <div className="grid gap-2 md:grid-cols-[1fr_8rem]">
                  <input value={item.medicamento} onChange={(e) => actualizar(item.id, "medicamento", e.target.value)} placeholder="Medicamento" className="rounded-lg border border-zinc-300 bg-white px-3 py-2" />
                  <input type="number" min="1" value={item.duracion_dias ?? ""} onChange={(e) => actualizar(item.id, "duracion_dias", e.target.value)} placeholder="Días" className="rounded-lg border border-zinc-300 bg-white px-3 py-2" />
                  <textarea value={item.dosis ?? ""} onChange={(e) => actualizar(item.id, "dosis", e.target.value)} placeholder="Dosis y horario" rows={2} className="rounded-lg border border-zinc-300 bg-white px-3 py-2 md:col-span-2" />
                  <textarea value={item.indicaciones ?? ""} onChange={(e) => actualizar(item.id, "indicaciones", e.target.value)} placeholder="Aclaraciones, una por renglón" rows={2} className="rounded-lg border border-zinc-300 bg-white px-3 py-2 md:col-span-2" />
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={agregar} className="mt-3 rounded-lg border border-dashed border-zinc-400 px-3 py-2 text-sm font-medium text-zinc-700">
            + Agregar renglón a esta impresión
          </button>
        </section>
      ) : null}

      <div className="print-area doc-imprimible relative mx-auto w-full bg-white text-zinc-900" style={{ aspectRatio: "2000 / 1294", containerType: "inline-size" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/recetario.png" alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "fill" }} />
        <span style={{ position: "absolute", left: "10%", top: "18.2%", fontSize: "1.6cqw" }}>{nombre}</span>
        <span style={{ position: "absolute", left: "50%", top: "18.2%", fontSize: "1.6cqw" }}>{edad}</span>
        <span style={{ position: "absolute", left: "71%", top: "18.2%", fontSize: "1.6cqw" }}>{fecha}</span>

        <div data-receta-contenido style={{ position: "absolute", left: `${izquierda}%`, top: `${inicio}%`, width: "53%", fontSize: `${tamano}cqw`, lineHeight: 1.35 }}>
          <ul style={{ display: "flex", flexDirection: "column", gap: `${separacion}cqw` }}>
            {items.map((item) => (
              <li key={item.id}>
                <div><span style={{ paddingRight: "0.6cqw" }}>*</span>{item.medicamento}{item.duracion_dias ? ` (${item.duracion_dias} días)` : ""}</div>
                {item.dosis ? <div style={{ paddingLeft: "1.6cqw", whiteSpace: "pre-line" }}>{item.dosis}</div> : null}
                {item.indicaciones ? <div style={{ paddingLeft: "1.6cqw", marginTop: "0.6cqw", whiteSpace: "pre-line" }}>{item.indicaciones}</div> : null}
              </li>
            ))}
          </ul>
          {fase ? <div data-receta-fase style={{ width: "42%", marginTop: "2cqw", padding: "0.6cqw 0", textAlign: "center", fontSize: "1.6cqw", fontWeight: 600, background: "#e7e2da", borderRadius: "0.4cqw" }}>FASE {fase}</div> : null}
        </div>

        <div data-receta-limite aria-hidden="true" style={{ position: "absolute", left: "5%", top: "82%", width: "53%" }} />
        <div style={{ position: "absolute", left: "3.5%", top: "85%", width: "20%" }}><CodigoBarrasReceta folio={folio} /></div>
        <span style={{ position: "absolute", left: "3.5%", top: "95.5%", fontSize: "1.05cqw", color: "#a1a1aa" }}>Folio #{folio}</span>
      </div>
    </>
  );
}
