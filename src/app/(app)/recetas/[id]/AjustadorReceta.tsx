"use client";

import { useMemo, useState, useTransition, type KeyboardEvent } from "react";
import { guardarReceta } from "../actions";
import CodigoBarrasReceta from "./CodigoBarrasReceta";
import PrintButton from "./PrintButton";

export type ItemImprimible = {
  id: string | null;
  medicamento: string;
  dosis: string | null;
  duracion_dias: number | null;
  indicaciones: string | null;
};

type ItemEditable = ItemImprimible & { clave: string };

type Props = {
  recetaId: string;
  nombre: string;
  edad: string;
  fecha: string;
  folio: number;
  fase: number | null;
  items: ItemImprimible[];
  ajustes: Record<string, unknown> | null;
};

function prepararItems(items: ItemImprimible[]): ItemEditable[] {
  return items.map((item, indice) => ({ ...item, clave: item.id ?? `nuevo-${indice}` }));
}

function numeroAjuste(ajustes: Record<string, unknown> | null, campo: string, base: number): number {
  return typeof ajustes?.[campo] === "number" ? ajustes[campo] : base;
}

function TextoConVinetas({ texto }: { texto: string }) {
  return texto.split("\n").map((linea, indice) => {
    const coincidencia = linea.match(/^(\t*)(\*{1,3}|[-•])\s*(.*)$/);
    if (!coincidencia) {
      const tabulaciones = linea.match(/^\t*/)?.[0].length ?? 0;
      return <div key={indice} style={{ marginLeft: `${tabulaciones * 1.2}cqw`, minHeight: "1lh", whiteSpace: "pre-wrap" }}>{linea.replace(/^\t+/, "")}</div>;
    }
    const profundidad = coincidencia[1].length + (coincidencia[2].startsWith("*") ? coincidencia[2].length - 1 : 0);
    return (
      <div key={indice} style={{ display: "flex", gap: "0.55cqw", marginLeft: `${profundidad * 1.2}cqw`, minHeight: "1lh" }}>
        <span aria-hidden="true">•</span>
        <span style={{ whiteSpace: "pre-wrap" }}>{coincidencia[3]}</span>
      </div>
    );
  });
}

export default function AjustadorReceta({ recetaId, nombre, edad, fecha, folio, fase: faseInicial, items: itemsIniciales, ajustes }: Props) {
  const originales = useMemo(() => prepararItems(itemsIniciales), [itemsIniciales]);
  const [guardando, iniciarGuardado] = useTransition();
  const [editando, setEditando] = useState(false);
  const [items, setItems] = useState<ItemEditable[]>(originales);
  const [fase, setFase] = useState(faseInicial?.toString() ?? "");
  const [tamano, setTamano] = useState(() => numeroAjuste(ajustes, "tamano", 1.5));
  const [separacion, setSeparacion] = useState(() => numeroAjuste(ajustes, "separacion", 1.5));
  const [izquierda, setIzquierda] = useState(() => numeroAjuste(ajustes, "izquierda", 5));
  const [inicio, setInicio] = useState(() => numeroAjuste(ajustes, "inicio", 28));
  const [mostrarMetricas, setMostrarMetricas] = useState(() => ajustes?.mostrar_metricas === true);
  const [siguienteId, setSiguienteId] = useState(itemsIniciales.length);
  const [mensaje, setMensaje] = useState("");

  function actualizar(clave: string, campo: keyof ItemImprimible, valor: string) {
    setItems((actuales) => actuales.map((item) => item.clave === clave
      ? { ...item, [campo]: campo === "duracion_dias" ? (valor ? Number(valor) : null) : valor }
      : item));
  }

  function insertarTabulacion(evento: KeyboardEvent<HTMLTextAreaElement>, clave: string, campo: "dosis" | "indicaciones") {
    if (evento.key !== "Tab") return;
    evento.preventDefault();
    const campoTexto = evento.currentTarget;
    const inicioSeleccion = campoTexto.selectionStart;
    const finSeleccion = campoTexto.selectionEnd;
    const valor = campoTexto.value.slice(0, inicioSeleccion) + "\t" + campoTexto.value.slice(finSeleccion);
    actualizar(clave, campo, valor);
    requestAnimationFrame(() => {
      campoTexto.selectionStart = campoTexto.selectionEnd = inicioSeleccion + 1;
    });
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
      id: null,
      clave: `nuevo-${siguienteId}`,
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
    setTamano(numeroAjuste(ajustes, "tamano", 1.5));
    setSeparacion(numeroAjuste(ajustes, "separacion", 1.5));
    setIzquierda(numeroAjuste(ajustes, "izquierda", 5));
    setInicio(numeroAjuste(ajustes, "inicio", 28));
    setMostrarMetricas(ajustes?.mostrar_metricas === true);
    setMensaje("");
  }

  function guardar() {
    setMensaje("");
    iniciarGuardado(async () => {
      const resultado = await guardarReceta(
        recetaId,
        fase ? Number(fase) : null,
        items.map(({ id, medicamento, dosis, duracion_dias, indicaciones }) => ({
          id,
          medicamento,
          dosis: dosis ?? "",
          duracion_dias,
          indicaciones: indicaciones ?? "",
        })),
        { tamano, separacion, izquierda, inicio, mostrar_metricas: mostrarMetricas },
      );
      setMensaje(resultado.ok ? "Receta guardada. Estos ajustes aparecerán al volver a abrirla." : resultado.error ?? "No se pudo guardar la receta.");
    });
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

      <div className={editando ? "grid items-start gap-5 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]" : ""}>
      {editando ? (
        <section className="max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm no-print lg:sticky lg:top-4">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-zinc-900">Ajustes de esta impresión</h2>
              <p className="text-sm text-zinc-500">La fase siempre cierra el texto impreso. Guarda para conservar los cambios.</p>
            </div>
            <button type="button" onClick={restablecer} className="text-sm font-medium text-zinc-600 underline">
              Restablecer
            </button>
          </div>

          <label className="mb-4 flex cursor-pointer items-center gap-3 rounded-xl bg-stone-100 px-3 py-3 text-sm font-medium text-zinc-800">
            <input type="checkbox" checked={mostrarMetricas} onChange={(e) => setMostrarMetricas(e.target.checked)} className="size-4 accent-stone-700" />
            Mostrar PESO, ESTATURA, IMC y medidas
          </label>

          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
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
              <div key={item.clave} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Medicamento {indice + 1}</span>
                  <div className="flex gap-1">
                    <button type="button" disabled={indice === 0} onClick={() => mover(indice, -1)} className="rounded border px-2 py-1 disabled:opacity-30" aria-label="Subir medicamento">↑</button>
                    <button type="button" disabled={indice === items.length - 1} onClick={() => mover(indice, 1)} className="rounded border px-2 py-1 disabled:opacity-30" aria-label="Bajar medicamento">↓</button>
                    <button type="button" onClick={() => setItems((actuales) => actuales.filter((actual) => actual.clave !== item.clave))} className="rounded border border-red-200 px-2 py-1 text-red-700" aria-label="Quitar medicamento">Quitar</button>
                  </div>
                </div>
                <div className="grid gap-2 md:grid-cols-[1fr_8rem]">
                  <input value={item.medicamento} onChange={(e) => actualizar(item.clave, "medicamento", e.target.value)} placeholder="Medicamento" className="rounded-lg border border-zinc-300 bg-white px-3 py-2" />
                  <input type="number" min="1" value={item.duracion_dias ?? ""} onChange={(e) => actualizar(item.clave, "duracion_dias", e.target.value)} placeholder="Días" className="rounded-lg border border-zinc-300 bg-white px-3 py-2" />
                  <textarea value={item.dosis ?? ""} onChange={(e) => actualizar(item.clave, "dosis", e.target.value)} onKeyDown={(e) => insertarTabulacion(e, item.clave, "dosis")} placeholder="Dosis y horario" rows={2} className="rounded-lg border border-zinc-300 bg-white px-3 py-2 md:col-span-2" />
                  <textarea value={item.indicaciones ?? ""} onChange={(e) => actualizar(item.clave, "indicaciones", e.target.value)} onKeyDown={(e) => insertarTabulacion(e, item.clave, "indicaciones")} placeholder="Aclaraciones, una por renglón" rows={2} className="rounded-lg border border-zinc-300 bg-white px-3 py-2 md:col-span-2" />
                  <p className="text-xs text-zinc-500 md:col-span-2">Enter: nuevo renglón · * texto: viñeta · ** texto: viñeta con sangría · Tab: sangría libre</p>
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={agregar} className="mt-3 rounded-lg border border-dashed border-zinc-400 px-3 py-2 text-sm font-medium text-zinc-700">
            + Agregar medicamento
          </button>
          <button type="button" disabled={guardando} onClick={guardar} className="mt-3 w-full rounded-lg bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50">
            {guardando ? "Guardando…" : "Guardar receta"}
          </button>
          {mensaje ? <p role="status" className={`mt-2 text-sm font-medium ${mensaje.startsWith("Receta guardada") ? "text-emerald-700" : "text-red-700"}`}>{mensaje}</p> : null}
        </section>
      ) : null}

      <div className="print-area doc-imprimible relative mx-auto w-full bg-white text-zinc-900 lg:sticky lg:top-4" style={{ aspectRatio: "2000 / 1294", containerType: "inline-size" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/recetario.png" alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "fill" }} />
        {!mostrarMetricas ? (
          <div
            data-receta-metricas-ocultas
            aria-hidden="true"
            style={{ position: "absolute", left: "64.5%", top: "25%", width: "22.5%", height: "27%", background: "white" }}
          />
        ) : null}
        <span style={{ position: "absolute", left: "10%", top: "18.2%", fontSize: "1.6cqw" }}>{nombre}</span>
        <span style={{ position: "absolute", left: "50%", top: "18.2%", fontSize: "1.6cqw" }}>{edad}</span>
        <span style={{ position: "absolute", left: "71%", top: "18.2%", fontSize: "1.6cqw" }}>{fecha}</span>

        <div data-receta-contenido style={{ position: "absolute", left: `${izquierda}%`, top: `${inicio}%`, width: "53%", fontSize: `${tamano}cqw`, lineHeight: 1.35 }}>
          <ul style={{ display: "flex", flexDirection: "column", gap: `${separacion}cqw` }}>
            {items.map((item) => (
              <li key={item.clave}>
                <div><span style={{ paddingRight: "0.6cqw" }}>*</span>{item.medicamento}{item.duracion_dias ? ` (${item.duracion_dias} días)` : ""}</div>
                {item.dosis ? <div style={{ paddingLeft: "1.6cqw" }}><TextoConVinetas texto={item.dosis} /></div> : null}
                {item.indicaciones ? <div style={{ paddingLeft: "1.6cqw", marginTop: "0.6cqw" }}><TextoConVinetas texto={item.indicaciones} /></div> : null}
              </li>
            ))}
          </ul>
          {fase ? <div data-receta-fase style={{ width: "42%", marginTop: "2cqw", padding: "0.6cqw 0", textAlign: "center", fontSize: "1.6cqw", fontWeight: 600, background: "#e7e2da", borderRadius: "0.4cqw" }}>FASE {fase}</div> : null}
        </div>

        <div data-receta-limite aria-hidden="true" style={{ position: "absolute", left: "5%", top: "82%", width: "53%" }} />
        <div style={{ position: "absolute", left: "3.5%", top: "85%", width: "20%" }}><CodigoBarrasReceta folio={folio} /></div>
        <span style={{ position: "absolute", left: "3.5%", top: "95.5%", fontSize: "1.05cqw", color: "#a1a1aa" }}>Folio #{folio}</span>
      </div>
      </div>
    </>
  );
}
