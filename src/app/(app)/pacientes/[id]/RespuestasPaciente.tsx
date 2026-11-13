"use client";

import { useState } from "react";
import { prepararCamposHistoria, sexoNormalizado } from "@/lib/historia-campos";
import { crearCamposRemotos, importarRespuestasRemotas, validarArchivoRemoto, MAX_RESPUESTAS_BYTES, type RespuestasRemotas } from "@/lib/historia-remota";
import type { Tipo } from "./NuevaHistoria";

export default function RespuestasPaciente({ nombrePaciente, sexoPaciente, tipos, onImportar, disabled = false }: {
  nombrePaciente: string;
  sexoPaciente: string | null;
  tipos: Tipo[];
  onImportar: (tipoId: string, valores: Record<string, unknown>, nombre: string) => void;
  disabled?: boolean;
}) {
  const [archivo, setArchivo] = useState<RespuestasRemotas | null>(null);
  const [confirmado, setConfirmado] = useState(false);
  const [error, setError] = useState("");
  const tipo = tipos.find(t => t.nombre === "Historia Clínica (NOM-004)");
  async function leer(file?: File) {
    if (!file) return;
    setError(""); setArchivo(null); setConfirmado(false);
    try {
      if (file.size > MAX_RESPUESTAS_BYTES) throw new Error("El archivo supera 64 KB.");
      if (!tipo) throw new Error("La plantilla de historia clínica no está disponible.");
      setArchivo(validarArchivoRemoto(await file.text(), crearCamposRemotos(prepararCamposHistoria(tipo.campos_historia))));
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo leer el archivo."); }
  }
  function cargar() {
    if (!archivo || !confirmado || !tipo) return;
    try {
      const campos = prepararCamposHistoria(tipo.campos_historia);
      const sexoDestino = sexoNormalizado(sexoPaciente);
      const publicos = crearCamposRemotos(campos);
      if (sexoDestino && ((archivo.sexo && sexoDestino !== archivo.sexo) || publicos.some(c => c.solo_sexo && c.solo_sexo !== sexoDestino && Object.hasOwn(archivo.respuestas,c.id)))) throw new Error("El sexo declarado o las respuestas no coinciden con el expediente. Revisa los datos del paciente antes de importar; conserva el archivo.");
      const valores = importarRespuestasRemotas(archivo, crearCamposRemotos(campos), campos);
      onImportar(tipo.id, valores, archivo.nombre); setArchivo(null); setConfirmado(false); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudieron cargar las respuestas."); }
  }
  return <details className="mb-4 rounded-xl bg-white p-4 ring-1 ring-zinc-200">
    <summary className="cursor-pointer text-sm font-medium text-zinc-800">Formulario para paciente remoto</summary>
    <div className="mt-3 space-y-3 text-sm">
      <p className="text-zinc-600">Comparte el formulario por WhatsApp. Cuando el paciente devuelva el archivo, cárgalo aquí y revisa el borrador antes de guardar la historia.</p>
      <div className="flex flex-wrap gap-2">
        <a href="/formulario/historia" target="_blank" rel="noreferrer" className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-700">Abrir formulario para compartir</a>
        <button type="button" disabled={disabled} className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-700" onClick={async () => {
          try { await navigator.clipboard.writeText(new URL('/formulario/historia', window.location.origin).href); setError('Enlace copiado. Pégalo en el chat del paciente.'); }
          catch { setError('Abre el formulario y copia su dirección para compartirla.'); }
        }}>Copiar enlace</button>
        <label className="cursor-pointer rounded-lg border border-zinc-300 px-3 py-2 text-zinc-700">Cargar respuestas<input type="file" disabled={disabled} className="sr-only" accept="application/json,.json" onChange={e => { void leer(e.target.files?.[0]); e.target.value = ""; }} /></label>
      </div>
      {archivo && <div className="space-y-3 rounded-lg bg-stone-50 p-3 text-zinc-800">
        <p>Nombre declarado: {archivo.nombre}. Nacimiento: {archivo.fecha_nac || "Sin responder"}. Sexo: {archivo.sexo || "Sin responder"}.</p>
        <p>Expediente destino: {nombrePaciente}. El archivo no modifica sus datos de identificación.</p>
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={confirmado} onChange={e => setConfirmado(e.target.checked)} />Confirmé que corresponde a este paciente.</label>
        <button type="button" disabled={!confirmado || !tipo || disabled} onClick={cargar} className="rounded-lg bg-zinc-900 px-4 py-2 text-white disabled:opacity-40">Cargar como borrador</button>
        {!tipo && <p>No está disponible la plantilla de historia clínica en este expediente.</p>}
      </div>}
      {error && <p role="status" className="text-sm text-zinc-700">{error}</p>}
    </div>
  </details>;
}
