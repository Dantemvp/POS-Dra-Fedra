"use client";

import { useRef, useState, useTransition } from "react";
import { listarIdentificaciones, subirIdentificacion, abrirIdentificacion } from "../identificaciones-actions";
import { MAX_IDENTIFICACION_BYTES, TIPOS_IDENTIFICACION, type TipoIdentificacion } from "@/lib/identificacion-paciente";

export default function IdentificacionesPaciente({ pacienteId }: { pacienteId: string }) {
  const [archivos, setArchivos] = useState<{ nombre: string; fecha: string | null }[] | null>(null);
  const [tipo, setTipo] = useState<TipoIdentificacion>("frente");
  const [mensaje, setMensaje] = useState("");
  const [pending, iniciar] = useTransition();
  const archivo = useRef<HTMLInputElement>(null);
  const camara = useRef<HTMLInputElement>(null);
  async function listar() {
    const res = await listarIdentificaciones(pacienteId);
    if (res.ok) setArchivos(res.archivos); else setMensaje(res.error);
  }
  function cargar(file?: File) {
    if (!file) return;
    setMensaje("");
    if (file.size > MAX_IDENTIFICACION_BYTES) { setMensaje("El archivo supera 4 MB. Elige una foto más pequeña o un PDF."); return; }
    iniciar(async () => {
      const form = new FormData(); form.set("paciente_id",pacienteId); form.set("tipo",tipo); form.set("archivo",file);
      try {
        const res = await subirIdentificacion(form);
        if (res.ok) { setMensaje("Identificación guardada en el espacio privado de este paciente."); await listar(); }
        else setMensaje(res.error);
      } catch { setMensaje("No se pudo confirmar la carga. Consulta la lista de identificaciones antes de reintentar."); }
    });
  }
  const boton = "min-h-11 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700 disabled:opacity-40";
  return <details className="mb-6 rounded-xl bg-white p-4 ring-1 ring-zinc-200" onToggle={e => { if (e.currentTarget.open && archivos === null && !pending) iniciar(async () => { try { await listar(); } catch { setMensaje("No se pudo consultar la lista. Intenta de nuevo."); } }); }}>
    <summary className="cursor-pointer text-sm font-medium text-zinc-900">Identificación del paciente</summary>
    <div className="mt-3 space-y-3">
      <p className="text-sm text-zinc-600">Agrega una foto o PDF de la identificación. Si corresponde a un tutor, elige esa opción. JPG, PNG, WebP o PDF, hasta 4 MB.</p>
      <label className="block text-sm text-zinc-700">Documento<select disabled={pending} value={tipo} onChange={e => setTipo(e.target.value as TipoIdentificacion)} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2">{Object.entries(TIPOS_IDENTIFICACION).map(([v,etiqueta]) => <option key={v} value={v}>{etiqueta}</option>)}</select></label>
      <div className="flex flex-wrap gap-2"><button type="button" className={boton} disabled={pending} onClick={() => camara.current?.click()}>Tomar foto</button><button type="button" className={boton} disabled={pending} onClick={() => archivo.current?.click()}>Elegir archivo</button><button type="button" className={boton} disabled={pending} onClick={() => iniciar(async () => { try { await listar(); } catch { setMensaje("No se pudo consultar la lista."); } })}>Actualizar lista</button></div>
      <input ref={camara} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={e => { cargar(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={archivo} type="file" accept="image/jpeg,image/png,image/webp,application/pdf,.pdf" className="hidden" onChange={e => { cargar(e.target.files?.[0]); e.target.value = ""; }} />
      <ul className="space-y-2">{archivos?.map(a => <li key={a.nombre} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700"><span>{TIPOS_IDENTIFICACION[a.nombre.split('-')[0] as TipoIdentificacion]} · {a.fecha ? new Date(a.fecha).toLocaleDateString('es-MX') : "Sin fecha"}</span><button type="button" className={boton} disabled={pending} onClick={() => iniciar(async () => {
        try { const res = await abrirIdentificacion(pacienteId,a.nombre); if (res.ok) window.location.assign(res.url); else setMensaje(res.error); }
        catch { setMensaje("No se pudo abrir la identificación. Intenta de nuevo."); }
      })}>Descargar</button></li>)}</ul>
      {archivos?.length === 0 && <p className="text-sm text-zinc-500">Sin identificaciones adjuntas.</p>}
      {pending && <p role="status" className="text-sm text-zinc-500">Procesando…</p>}
      {mensaje && <p role="status" className="text-sm text-zinc-700">{mensaje}</p>}
    </div>
  </details>;
}
