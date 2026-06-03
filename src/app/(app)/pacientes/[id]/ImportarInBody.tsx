"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  extraerInBody,
  crearHistoria,
  urlDocumento,
  type InBodyDatos,
} from "../actions";

// clave de IA -> etiqueta legible + unidad
const CAMPOS: [keyof InBodyDatos & string, string, string][] = [
  ["peso_kg", "Peso", "kg"],
  ["masa_muscular_kg", "Masa muscular (MME)", "kg"],
  ["grasa_pct", "% Grasa corporal", "%"],
  ["grasa_corporal_kg", "Masa grasa", "kg"],
  ["imc", "IMC", ""],
  ["grasa_visceral", "Grasa visceral", ""],
  ["tmb_kcal", "Tasa metabólica basal", "kcal"],
  ["agua_total_l", "Agua corporal total", "L"],
  ["masa_libre_grasa_kg", "Masa libre de grasa", "kg"],
  ["relacion_cintura_cadera", "Relación cintura-cadera", ""],
  ["grado_obesidad_pct", "Grado de obesidad", "%"],
  ["altura_cm", "Altura", "cm"],
  ["puntuacion_inbody", "Puntuación InBody", ""],
  ["fecha_prueba", "Fecha de la prueba", ""],
];

const etiquetaCompleta = (label: string, unit: string) =>
  unit ? `${label} (${unit})` : label;

export default function ImportarInBody({
  pacienteId,
  inbodyTipoId,
}: {
  pacienteId: string;
  inbodyTipoId: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fase, setFase] = useState<"idle" | "procesando" | "revision">("idle");
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function onArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setFase("procesando");

    const supabase = createClient();
    const path = `inbody/${pacienteId}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage
      .from("archivos")
      .upload(path, file);
    if (inputRef.current) inputRef.current.value = "";
    if (upErr) {
      setError(upErr.message);
      setFase("idle");
      return;
    }
    // URL firmada para mostrar la foto y poder cotejarla contra lo que leyó la IA.
    const doc = await urlDocumento(path);
    setDocUrl(doc.ok ? (doc.url ?? null) : null);

    const res = await extraerInBody(path);
    if (!res.ok || !res.datos) {
      setError(res.error ?? "No se pudo leer el InBody.");
      setFase("idle");
      return;
    }
    const init: Record<string, string> = {};
    for (const [key] of CAMPOS) {
      const v = res.datos[key];
      init[key] = v === null || v === undefined ? "" : String(v);
    }
    setValores(init);
    setFase("revision");
  }

  function guardar() {
    if (!inbodyTipoId) {
      setError("Falta el tipo de historia InBody.");
      return;
    }
    const datos: Record<string, unknown> = {};
    for (const [key, label, unit] of CAMPOS) {
      if (valores[key] !== "")
        datos[etiquetaCompleta(label, unit)] = valores[key];
    }
    startTransition(async () => {
      const res = await crearHistoria(pacienteId, inbodyTipoId, datos);
      if (!res.ok) {
        setError(res.error ?? "Error al guardar.");
        return;
      }
      setFase("idle");
      setValores({});
      setDocUrl(null);
      router.refresh();
    });
  }

  return (
    <div className="mb-6 rounded-xl bg-white p-5 ring-1 ring-zinc-200">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-medium text-zinc-900">Importar InBody</h2>
          <p className="text-xs text-zinc-500">
            Sube la foto del reporte y la IA llena los datos (tú confirmas).
          </p>
        </div>
        {fase === "idle" && (
          <label className="cursor-pointer rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800">
            Subir foto InBody
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onArchivo}
            />
          </label>
        )}
      </div>

      {fase === "procesando" && (
        <p className="mt-4 text-sm text-zinc-500">
          Leyendo y verificando el reporte… (puede tardar unos segundos)
        </p>
      )}

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {fase === "revision" && (
        <div className="mt-4">
          <p className="mb-3 rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
            Datos leídos del reporte. Coteja contra la foto y edita cualquier campo antes de guardar.
          </p>
          {docUrl && (
            <a
              href={docUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-3 block overflow-hidden rounded-lg ring-1 ring-zinc-200"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={docUrl}
                alt="Reporte InBody"
                className="max-h-72 w-full bg-zinc-50 object-contain"
              />
            </a>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {CAMPOS.map(([key, label, unit]) => (
              <div key={key}>
                <label className="mb-1 block text-xs font-medium text-zinc-600">
                  {etiquetaCompleta(label, unit)}
                </label>
                <input
                  value={valores[key] ?? ""}
                  onChange={(e) =>
                    setValores((p) => ({ ...p, [key]: e.target.value }))
                  }
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900"
                />
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={guardar}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Guardar en historia
            </button>
            <button
              onClick={() => {
                setFase("idle");
                setError(null);
                setDocUrl(null);
              }}
              className="rounded-lg px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
