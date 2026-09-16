"use client";

import { useMemo, useState, useTransition, type KeyboardEvent } from "react";
import { guardarReceta } from "../actions";
import {
  metricasVacias,
  MAX_TEXTO_FASE,
  MAX_TEXTO_METRICA,
  type ClaveMetricaReceta,
  type MetricasReceta,
} from "../ajustes-impresion";
import SelectorPlantillas from "../SelectorPlantillas";
import type { PlantillaReceta } from "../plantillas";
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
  metricasReceta: Record<string, unknown> | null;
  plantillas: PlantillaReceta[];
};

// Los seis renglones ya vienen impresos en recetario.png (2000 x 1294 px). Las
// cifras salen de medir la tinta de la imagen: `ancho` tapa la etiqueta cuando
// las métricas se ocultan y `valorEn` es donde arranca lo que escribe Fernanda,
// justo después de los dos puntos.
const RENGLONES_METRICAS = [
  { clave: "peso", etiqueta: "Peso", top: "28.7%", ancho: 7.5, valorEn: 70.3 },
  { clave: "estatura", etiqueta: "Estatura", top: "32.5%", ancho: 10.5, valorEn: 73.6 },
  { clave: "imc", etiqueta: "IMC", top: "36.3%", ancho: 5.5, valorEn: 69.5 },
  { clave: "peso_ideal", etiqueta: "Peso máximo ideal", top: "40.1%", ancho: 18.5, valorEn: 80.7 },
  { clave: "peso_sugerido", etiqueta: "Peso sugerido", top: "43.9%", ancho: 15.5, valorEn: 77.6 },
  { clave: "cintura", etiqueta: "Cintura", top: "47.7%", ancho: 9.5, valorEn: 72.9 },
] as const satisfies readonly { clave: ClaveMetricaReceta; etiqueta: string; top: string; ancho: number; valorEn: number }[];

const COLUMNA_METRICAS = 64.5;

// Banda libre del membrete entre el renglón de FECHA (termina en 23.1%) y la
// etiqueta PESO (empieza en 29.9%). Ahí cabe la fase sin tapar nada impreso.
const FASE_TOP = "24.3%";
const MARGEN_DERECHO = 94.5;

// Acepta "1.65", "165" y "1,65". Devuelve metros o null si no hay un número.
function estaturaEnMetros(texto: string): number | null {
  const valor = Number(texto.replace(",", ".").replace(/[^\d.]/g, ""));
  if (!Number.isFinite(valor) || valor <= 0) return null;
  const metros = valor > 3 ? valor / 100 : valor;
  return metros >= 0.5 && metros <= 2.5 ? metros : null;
}

function pesoEnKilos(texto: string): number | null {
  const valor = Number(texto.replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(valor) && valor > 0 && valor < 500 ? valor : null;
}

// La doctora pidió que el IMC se calcule solo al capturar peso y estatura.
function calcularImc(peso: string, estatura: string): string {
  const kg = pesoEnKilos(peso);
  const m = estaturaEnMetros(estatura);
  if (kg === null || m === null) return "";
  return (kg / (m * m)).toFixed(1);
}

// La columna `fase` sigue siendo numérica porque de ella dependen el filtro de
// recetas y las gráficas del panel. Se deduce del primer número del texto para
// que Fernanda escriba una sola vez.
function faseNumericaDe(texto: string): number | null {
  const encontrado = texto.match(/\d+/);
  if (!encontrado) return null;
  const numero = Number(encontrado[0]);
  return Number.isSafeInteger(numero) && numero >= 0 ? numero : null;
}

function prepararItems(items: ItemImprimible[]): ItemEditable[] {
  return items.map((item, indice) => ({ ...item, clave: item.id ?? `nuevo-${indice}` }));
}

function numeroAjuste(ajustes: Record<string, unknown> | null, campo: string, base: number): number {
  return typeof ajustes?.[campo] === "number" ? ajustes[campo] : base;
}

// Recetas guardadas antes de este cambio no traen `fase_texto`: se arma desde
// el número para que sigan imprimiendo igual.
function textoFaseInicial(ajustes: Record<string, unknown> | null, fase: number | null): string {
  const guardado = ajustes?.fase_texto;
  if (typeof guardado === "string" && guardado.trim() !== "") return guardado;
  return fase === null ? "" : `FASE ${fase}`;
}

// El IMC que trae el InBody se sigue recalculando si cambian peso o estatura.
// Solo manda el que alguien escribió aquí, al ajustar la impresión.
function imcEscritoAMano(ajustes: Record<string, unknown> | null): boolean {
  const guardadas = ajustes?.metricas;
  if (!guardadas || typeof guardadas !== "object") return false;
  const imc = (guardadas as Record<string, unknown>).imc;
  return typeof imc === "string" && imc.trim() !== "";
}

function copiarMetricas(destino: MetricasReceta, origen: unknown) {
  if (!origen || typeof origen !== "object") return;
  for (const clave of Object.keys(destino) as ClaveMetricaReceta[]) {
    const valor = (origen as Record<string, unknown>)[clave];
    if (valor != null && String(valor).trim() !== "") destino[clave] = String(valor);
  }
}

// Al crear la receta ya se capturan peso, estatura e IMC (los trae el InBody) y
// se guardan en `recetas.metricas`. Lo que se ajusta al imprimir manda sobre eso.
function metricasIniciales(
  ajustes: Record<string, unknown> | null,
  metricasReceta: Record<string, unknown> | null,
): MetricasReceta {
  const metricas = metricasVacias();
  copiarMetricas(metricas, metricasReceta);
  copiarMetricas(metricas, ajustes?.metricas);
  return metricas;
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

export default function AjustadorReceta({ recetaId, nombre, edad, fecha, folio, fase: faseInicial, items: itemsIniciales, ajustes, metricasReceta, plantillas }: Props) {
  const originales = useMemo(() => prepararItems(itemsIniciales), [itemsIniciales]);
  const [guardando, iniciarGuardado] = useTransition();
  const [editando, setEditando] = useState(false);
  const [items, setItems] = useState<ItemEditable[]>(originales);
  const [faseTexto, setFaseTexto] = useState(() => textoFaseInicial(ajustes, faseInicial));
  const [metricas, setMetricas] = useState<MetricasReceta>(() => metricasIniciales(ajustes, metricasReceta));
  const [imcManual, setImcManual] = useState(() => imcEscritoAMano(ajustes));
  const [tamano, setTamano] = useState(() => numeroAjuste(ajustes, "tamano", 1.5));
  const [separacion, setSeparacion] = useState(() => numeroAjuste(ajustes, "separacion", 1.5));
  const [izquierda, setIzquierda] = useState(() => numeroAjuste(ajustes, "izquierda", 5));
  const [inicio, setInicio] = useState(() => numeroAjuste(ajustes, "inicio", 28));
  const [mostrarMetricas, setMostrarMetricas] = useState(() => (
    typeof ajustes?.mostrar_metricas === "boolean"
      ? ajustes.mostrar_metricas
      : Object.values(metricasIniciales(ajustes, metricasReceta)).some((valor) => valor !== "")
  ));
  const [siguienteId, setSiguienteId] = useState(itemsIniciales.length);
  const [mensaje, setMensaje] = useState("");

  function actualizar(clave: string, campo: keyof ItemImprimible, valor: string) {
    setItems((actuales) => actuales.map((item) => item.clave === clave
      ? { ...item, [campo]: campo === "duracion_dias" ? (valor ? Number(valor) : null) : valor }
      : item));
  }

  function actualizarMetrica(clave: ClaveMetricaReceta, valor: string) {
    const limpio = valor.slice(0, MAX_TEXTO_METRICA);
    if (clave === "imc") {
      // Escribir el IMC a mano manda sobre el cálculo; borrarlo lo devuelve.
      setImcManual(limpio.trim() !== "");
      setMetricas((actuales) => ({ ...actuales, imc: limpio }));
      return;
    }
    setMetricas((actuales) => {
      const siguientes = { ...actuales, [clave]: limpio };
      if (!imcManual && (clave === "peso" || clave === "estatura")) {
        const calculado = calcularImc(siguientes.peso, siguientes.estatura);
        if (calculado !== "") siguientes.imc = calculado;
      }
      return siguientes;
    });
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

  function aplicarPlantilla(plantilla: PlantillaReceta) {
    setItems(plantilla.items.map((item, indice) => ({
      id: null,
      clave: `plantilla-${siguienteId + indice}`,
      medicamento: item.medicamento,
      dosis: item.dosis,
      duracion_dias: item.duracion_dias,
      indicaciones: item.indicaciones,
    })));
    setSiguienteId((id) => id + plantilla.items.length);
    if (plantilla.fase_texto) setFaseTexto(plantilla.fase_texto);
    setMensaje(`Plantilla "${plantilla.nombre}" cargada. Revisa y guarda.`);
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
    setFaseTexto(textoFaseInicial(ajustes, faseInicial));
    setMetricas(metricasIniciales(ajustes, metricasReceta));
    setImcManual(imcEscritoAMano(ajustes));
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
        faseNumericaDe(faseTexto),
        items.map(({ id, medicamento, dosis, duracion_dias, indicaciones }) => ({
          id,
          medicamento,
          dosis: dosis ?? "",
          duracion_dias,
          indicaciones: indicaciones ?? "",
        })),
        {
          tamano,
          separacion,
          izquierda,
          inicio,
          mostrar_metricas: mostrarMetricas,
          fase_texto: faseTexto,
          metricas,
        },
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
              <p className="text-sm text-zinc-500">La fase se imprime arriba a la derecha y deja libre el pie de la hoja. Guarda para conservar los cambios.</p>
            </div>
            <button type="button" onClick={restablecer} className="text-sm font-medium text-zinc-600 underline">
              Restablecer
            </button>
          </div>

          <SelectorPlantillas plantillas={plantillas} onAplicar={aplicarPlantilla} />

          <div className="mb-4 rounded-xl bg-stone-100 px-3 py-3">
            <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-zinc-800">
              <input type="checkbox" checked={mostrarMetricas} onChange={(e) => setMostrarMetricas(e.target.checked)} className="size-4 accent-stone-700" />
              Mostrar PESO, ESTATURA, IMC y medidas
            </label>
            {mostrarMetricas ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                {RENGLONES_METRICAS.map((renglon) => (
                  <label key={renglon.clave} className="grid grid-cols-[9rem_minmax(0,1fr)] items-center gap-2 text-sm text-zinc-700">
                    <span>{renglon.etiqueta}{renglon.clave === "imc" && !imcManual ? " (automático)" : ""}</span>
                    <input
                      value={metricas[renglon.clave]}
                      onChange={(e) => actualizarMetrica(renglon.clave, e.target.value)}
                      maxLength={MAX_TEXTO_METRICA}
                      inputMode={renglon.clave === "imc" ? "decimal" : undefined}
                      placeholder={renglon.clave === "estatura" ? "1.65" : ""}
                      className="rounded-lg border border-zinc-300 bg-white px-3 py-2"
                    />
                  </label>
                ))}
                <p className="text-xs text-zinc-500">
                  El IMC se calcula con el peso y la estatura. Si lo escribes a mano manda el tuyo; bórralo para volver al cálculo.
                </p>
              </div>
            ) : null}
          </div>

          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <label className="text-sm text-zinc-700">Fase
              <input value={faseTexto} onChange={(e) => setFaseTexto(e.target.value)} maxLength={MAX_TEXTO_FASE} placeholder="FASE 1" className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2" />
              <span className="mt-1 block text-xs text-zinc-500">
                Texto libre, se imprime tal cual. {faseNumericaDe(faseTexto) === null
                  ? "Sin un número la receta deja de aparecer en el filtro por fase."
                  : `Se archiva como fase ${faseNumericaDe(faseTexto)}.`}
              </span>
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
        {RENGLONES_METRICAS.map((renglon) => (mostrarMetricas ? (
          <span
            key={renglon.clave}
            data-receta-metrica={renglon.clave}
            style={{ position: "absolute", left: `${renglon.valorEn}%`, top: renglon.top, height: "3.2%", display: "flex", alignItems: "center", fontSize: "1.5cqw", whiteSpace: "nowrap" }}
          >
            {metricas[renglon.clave]}
          </span>
        ) : (
          <div
            key={renglon.clave}
            data-receta-metrica-oculta
            aria-hidden="true"
            style={{ position: "absolute", left: `${COLUMNA_METRICAS}%`, top: renglon.top, width: `${renglon.ancho}%`, height: "3.2%", background: "white" }}
          />
        )))}

        {/* La fase cierra arriba a la derecha, sobre la columna de medidas, para
            no comer el espacio en el que la doctora escribe a mano. */}
        {faseTexto.trim() ? (
          <div style={{ position: "absolute", left: `${COLUMNA_METRICAS}%`, top: FASE_TOP, width: `${MARGEN_DERECHO - COLUMNA_METRICAS}%`, display: "flex", justifyContent: "flex-end" }}>
            <span data-receta-fase style={{ padding: "0.5cqw 1.4cqw", fontSize: "1.6cqw", fontWeight: 600, background: "#e7e2da", borderRadius: "0.4cqw", whiteSpace: "nowrap" }}>
              {faseTexto.trim()}
            </span>
          </div>
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
        </div>

        <div data-receta-limite aria-hidden="true" style={{ position: "absolute", left: "5%", top: "82%", width: "53%" }} />
        <div style={{ position: "absolute", left: "3.5%", top: "85%", width: "20%" }}><CodigoBarrasReceta folio={folio} /></div>
        <span style={{ position: "absolute", left: "3.5%", top: "95.5%", fontSize: "1.05cqw", color: "#a1a1aa" }}>Folio #{folio}</span>
      </div>
      </div>
    </>
  );
}
