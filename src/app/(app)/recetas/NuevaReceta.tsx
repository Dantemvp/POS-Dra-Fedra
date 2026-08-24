"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { crearReceta, ultimoInBody, type ItemReceta } from "./actions";
import ComboBuscador from "@/components/ComboBuscador";
import {
  extraerInBody,
  registrarDocumentoClinico,
} from "../pacientes/actions";
import { createClient } from "@/lib/supabase/client";
import { fechaSinaloa } from "@/lib/tz";
import { rutaInBody, validarArchivoInBody } from "@/lib/inbody";

// InBody guardado (claves legibles) -> métricas de la receta
function mapInBodyGuardado(d: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  if (d["Peso (kg)"] != null) out.peso = String(d["Peso (kg)"]);
  if (d["IMC"] != null) out.imc = String(d["IMC"]);
  if (d["Altura (cm)"] != null) {
    const cm = Number(d["Altura (cm)"]);
    if (!isNaN(cm)) out.estatura = (cm / 100).toFixed(2);
  }
  return out;
}

// InBody recién extraído (claves crudas) -> métricas de la receta
function mapInBodyCrudo(d: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  if (d.peso_kg != null) out.peso = String(d.peso_kg);
  if (d.imc != null) out.imc = String(d.imc);
  if (d.altura_cm != null) {
    const cm = Number(d.altura_cm);
    if (!isNaN(cm)) out.estatura = (cm / 100).toFixed(2);
  }
  return out;
}

const input =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900";

const filaVacia: ItemReceta = {
  medicamento: "",
  dosis: "",
  duracion_dias: null,
  indicaciones: "",
};

const METRICAS: [string, string][] = [
  ["peso", "Peso (kg)"],
  ["estatura", "Estatura (m)"],
  ["imc", "IMC"],
  ["cintura", "Cintura (cm)"],
  ["peso_ideal", "Peso máximo ideal (kg)"],
  ["peso_sugerido", "Peso sugerido (kg)"],
];

export default function NuevaReceta({
  pacientes,
  productos,
}: {
  pacientes: { id: string; nombre: string }[];
  productos: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [pacienteId, setPacienteId] = useState("");
  const opcionesPaciente = useMemo(
    () => pacientes.map((p) => ({ value: p.id, label: p.nombre })),
    [pacientes],
  );
  // Mapa nombre(min)→id para ligar el medicamento al producto del inventario.
  const productoPorNombre = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of productos) m.set(p.nombre.trim().toLowerCase(), p.id);
    return m;
  }, [productos]);
  const [fase, setFase] = useState("");
  const [items, setItems] = useState<ItemReceta[]>([{ ...filaVacia }]);
  const [metricas, setMetricas] = useState<Record<string, string>>({});
  const [inbodyMsg, setInbodyMsg] = useState<string | null>(null);
  const [inbodyLoading, setInbodyLoading] = useState(false);
  // Ruta ya subida que todavía no tiene fila en documentos_clinicos.
  const [inbodyPendiente, setInbodyPendiente] = useState<string | null>(null);
  const inbodyInputRef = useRef<HTMLInputElement>(null);

  function cargarUltimoInBody() {
    if (!pacienteId) {
      setInbodyMsg("Selecciona un paciente primero.");
      return;
    }
    setInbodyMsg(null);
    startTransition(async () => {
      const res = await ultimoInBody(pacienteId);
      if (!res.ok || !res.datos) {
        setInbodyMsg(res.error ?? "Sin datos.");
        return;
      }
      setMetricas((p) => ({ ...p, ...mapInBodyGuardado(res.datos!) }));
      setInbodyMsg(
        "Cargado del último InBody" +
          (res.fecha ? " (" + fechaSinaloa(res.fecha) + ")" : "") +
          ".",
      );
    });
  }

  async function subirInBody(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const archivoValido = validarArchivoInBody(file);
    if (!archivoValido.ok) {
      setInbodyMsg(archivoValido.error);
      if (inbodyInputRef.current) inbodyInputRef.current.value = "";
      return;
    }
    if (!pacienteId) {
      setInbodyMsg("Selecciona un paciente primero.");
      return;
    }
    setInbodyMsg(null);
    setInbodyPendiente(null);
    setInbodyLoading(true);
    const supabase = createClient();
    // Una sola ruta por intento, para que el reintento del registro no suba el
    // objeto otra vez. Ver `rutaInBody` en `src/lib/inbody.ts`.
    const path = rutaInBody(pacienteId, file.type);
    const { error: upErr } = await supabase.storage
      .from("archivos")
      .upload(path, file);
    if (inbodyInputRef.current) inbodyInputRef.current.value = "";
    if (upErr) {
      setInbodyMsg(upErr.message);
      setInbodyLoading(false);
      return;
    }
    await registrarYLeerInBody(pacienteId, path);
  }

  // Misma regla que en la ficha de la paciente: el rastro se escribe dentro del
  // flujo que sube el archivo, no después. Y si el registro falla, la foto ya
  // está en el bucket y nadie puede retirarla, así que se ofrece reintentar el
  // registro en lugar de dejarla huérfana en silencio.
  async function registrarYLeerInBody(paciente: string, path: string) {
    setInbodyLoading(true);
    const reg = await registrarDocumentoClinico(paciente, path);
    if (!reg.ok) {
      setInbodyPendiente(path);
      setInbodyMsg(
        `${reg.error ?? "No se pudo registrar el documento clínico."} ` +
          "La foto ya quedó guardada: reintenta el registro, no la vuelvas a subir.",
      );
      setInbodyLoading(false);
      return;
    }
    setInbodyPendiente(null);
    const res = await extraerInBody(path);
    setInbodyLoading(false);
    if (!res.ok || !res.datos) {
      setInbodyMsg(res.error ?? "No se pudo leer el InBody.");
      return;
    }
    setMetricas((p) => ({ ...p, ...mapInBodyCrudo(res.datos!) }));
    setInbodyMsg("Datos cargados desde la foto del InBody.");
  }
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function setItem(idx: number, patch: Partial<ItemReceta>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function guardar() {
    setMsg(null);
    // Liga cada renglón a un producto del inventario si el nombre coincide.
    const itemsLigados = items.map((it) => ({
      ...it,
      producto_id:
        productoPorNombre.get(it.medicamento.trim().toLowerCase()) ?? null,
    }));
    startTransition(async () => {
      const res = await crearReceta(
        pacienteId,
        fase ? Number(fase) : null,
        itemsLigados,
        metricas,
      );
      if (!res.ok) {
        setMsg(res.error ?? "Error.");
        return;
      }
      router.push(`/recetas/${res.id}`);
    });
  }

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="mb-6 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
      >
        + Nueva receta
      </button>
    );
  }

  return (
    <div className="mb-6 rounded-xl bg-white p-5 ring-1 ring-zinc-200">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600">
            Paciente *
          </label>
          <ComboBuscador
            opciones={opcionesPaciente}
            value={pacienteId}
            onChange={setPacienteId}
            placeholder="Busca al paciente por nombre…"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600">
            Fase
          </label>
          <select value={fase} onChange={(e) => setFase(e.target.value)} className={input}>
            <option value="">—</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                Fase {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <p className="text-xs font-medium uppercase text-zinc-500">
            Control de peso (opcional)
          </p>
          <button
            type="button"
            onClick={cargarUltimoInBody}
            className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Cargar último InBody
          </button>
          <label className="cursor-pointer rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50">
            {inbodyLoading ? "Leyendo…" : "Subir InBody (foto)"}
            <input
              ref={inbodyInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={subirInBody}
              disabled={inbodyLoading}
            />
          </label>
        </div>
        {inbodyMsg && <p className="mb-2 text-xs text-zinc-500">{inbodyMsg}</p>}
        {inbodyPendiente && !inbodyLoading && (
          <button
            type="button"
            onClick={() => registrarYLeerInBody(pacienteId, inbodyPendiente)}
            className="mb-2 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800"
          >
            Reintentar el registro
          </button>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {METRICAS.map(([key, label]) => (
            <div key={key}>
              <label className="mb-1 block text-xs font-medium text-zinc-600">
                {label}
              </label>
              <input
                className={input}
                value={metricas[key] ?? ""}
                onChange={(e) =>
                  setMetricas((p) => ({ ...p, [key]: e.target.value }))
                }
              />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <p className="text-xs font-medium uppercase text-zinc-500">Medicamentos</p>
        {/* Sugerencias del inventario; el campo sigue aceptando texto libre. */}
        <datalist id="lista-medicamentos">
          {productos.map((p) => (
            <option key={p.id} value={p.nombre} />
          ))}
        </datalist>
        {items.map((it, idx) => (
          <div key={idx} className="grid grid-cols-1 gap-2 rounded-lg bg-zinc-50 p-3 sm:grid-cols-12">
            <input
              className={`${input} sm:col-span-4`}
              placeholder="Medicamento (busca o escribe)"
              list="lista-medicamentos"
              value={it.medicamento}
              onChange={(e) => setItem(idx, { medicamento: e.target.value })}
            />
            <textarea
              className={`${input} resize-y sm:col-span-3`}
              rows={2}
              placeholder={"Dosis. Enter para esquemas:\nSem 1: 0.25 mg\nSem 2: 0.5 mg"}
              value={it.dosis}
              onChange={(e) => setItem(idx, { dosis: e.target.value })}
            />
            <input
              className={`${input} self-start sm:col-span-2`}
              type="number"
              placeholder="Días"
              value={it.duracion_dias ?? ""}
              onChange={(e) =>
                setItem(idx, {
                  duracion_dias: e.target.value ? Number(e.target.value) : null,
                })
              }
            />
            <textarea
              className={`${input} resize-y sm:col-span-3`}
              rows={2}
              placeholder="Indicaciones"
              value={it.indicaciones}
              onChange={(e) => setItem(idx, { indicaciones: e.target.value })}
            />
          </div>
        ))}
        <button
          onClick={() => setItems((p) => [...p, { ...filaVacia }])}
          className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
        >
          + Agregar medicamento
        </button>
      </div>

      {msg && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {msg}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <button
          onClick={guardar}
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {pending ? "Generando…" : "Generar receta"}
        </button>
        <button
          onClick={() => setAbierto(false)}
          className="rounded-lg px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
