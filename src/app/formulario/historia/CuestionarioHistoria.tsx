"use client";

import { useEffect, useRef, useState } from "react";
import CamposHistoria from "@/components/CamposHistoria";
import ThemeToggle from "@/components/ThemeToggle";
import { campoVisible, type CampoHistoria } from "@/lib/historia-campos";
import { MAX_RESPUESTAS_BYTES, textoRespuestasRemotas, validarArchivoRemoto, type RespuestasRemotas } from "@/lib/historia-remota";

export default function CuestionarioHistoria({ campos }: { campos: CampoHistoria[] }) {
  const secciones = [...new Set(campos.map(c => c.seccion ?? "Datos"))];
  const [paso, setPaso] = useState(0);
  const [nombre, setNombre] = useState("");
  const [nacimiento, setNacimiento] = useState("");
  const [sexo, setSexo] = useState<"F" | "M" | null>(null);
  const [valores, setValores] = useState<Record<string, unknown>>({});
  const [mensaje, setMensaje] = useState("");
  const [texto, setTexto] = useState("");
  const titulo = useRef<HTMLHeadingElement>(null);
  const total = secciones.length + 2;
  const modificado = nombre !== "" || nacimiento !== "" || sexo !== null || Object.keys(valores).length > 0;

  useEffect(() => {
    if (!modificado) return;
    const avisar = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [modificado]);

  function cambiarPaso(siguiente: number) {
    setPaso(siguiente); setMensaje("");
    requestAnimationFrame(() => { titulo.current?.focus(); window.scrollTo({ top: 0, behavior: "instant" }); });
  }
  function archivo(): RespuestasRemotas {
    // Quita únicamente detalles cerrados. No completa respuestas ni guarda No
    // aplica en nombre de quien está contestando.
    const respuestas = Object.fromEntries(Object.entries(valores).filter(([id, v]) => {
      const c = campos.find(c => c.id === id);
      return c && campoVisible(c, valores, sexo) && v != null && v !== "" && !(Array.isArray(v) && !v.length);
    }));
    return validarArchivoRemoto(JSON.stringify({ formato: "fedra-historia-paciente", version: 1, nombre, fecha_nac: nacimiento || null, sexo, respuestas }), campos);
  }
  async function devolver(compartir: boolean) {
    setMensaje("");
    try {
      const contenido = JSON.stringify(archivo(), null, 2);
      const file = new File([contenido], "respuestas-fedra.json", { type: "application/json" });
      if (compartir && navigator.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({ files: [file], title: "Respuestas para mi consulta" });
        setMensaje("Comprueba en el chat del consultorio que adjuntaste el archivo.");
      } else {
        const url = URL.createObjectURL(file);
        const a = document.createElement("a"); a.href = url; a.download = file.name; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 30_000);
        setMensaje("Archivo preparado. Adjunta respuestas-fedra.json en tu chat con el consultorio.");
      }
    } catch (e) { if (!(e instanceof DOMException && e.name === "AbortError")) setMensaje(e instanceof Error ? e.message : "No se pudo preparar el archivo. Intenta copiar las respuestas."); }
  }
  async function copiar() {
    try {
      const resumen = textoRespuestasRemotas(archivo(), campos); setTexto(resumen);
      try { await navigator.clipboard.writeText(resumen); setMensaje("Respuestas copiadas. Pégalas en tu chat con el consultorio."); }
      catch { setMensaje("Selecciona y copia el texto de abajo para pegarlo en tu chat."); }
    } catch (e) { setMensaje(e instanceof Error ? e.message : "Revisa tus respuestas."); }
  }
  async function continuar(file?: File) {
    if (!file) return;
    try {
      if (file.size > MAX_RESPUESTAS_BYTES) throw new Error("El archivo supera 64 KB.");
      const previo = validarArchivoRemoto(await file.text(), campos);
      if (modificado && !window.confirm("¿Reemplazar lo que llevas contestado por el archivo?")) return;
      setNombre(previo.nombre); setNacimiento(previo.fecha_nac ?? ""); setSexo(previo.sexo); setValores(previo.respuestas); setTexto("");
      setMensaje("Respuestas recuperadas en este formulario. Puedes seguir contestando.");
    } catch (e) { setMensaje(e instanceof Error ? e.message : "No se pudo abrir el archivo."); }
  }

  const boton = "min-h-11 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 disabled:opacity-40";
  const input = "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-3 text-zinc-900";
  return <main className="mx-auto min-h-screen max-w-2xl px-4 py-6 sm:py-10">
    <header className="mb-6 flex items-start justify-between gap-4"><div><p className="text-sm text-zinc-500">Dra. Fedra Aldama</p><h1 className="mt-1 text-2xl font-semibold text-zinc-900">Preguntas para tu consulta</h1></div><ThemeToggle /></header>
    <p className="mb-2 text-sm text-zinc-600">Contesta lo que puedas. Si no sabes una respuesta, déjala pendiente; el consultorio te ayudará.</p>
    <p className="mb-5 text-xs text-zinc-500">Tus respuestas permanecen en esta pestaña hasta que cierres o recargues. Descarga el archivo para continuar después o devolverlo al consultorio. Este formulario no envía respuestas por sí solo.</p>
    <div className="mb-5 flex flex-wrap gap-2">
      <label className={`${boton} cursor-pointer`}>Continuar con archivo<input type="file" accept="application/json,.json" className="sr-only" onChange={e => { void continuar(e.target.files?.[0]); e.target.value = ""; }} /></label>
      <button type="button" className={boton} onClick={() => void devolver(false)}>Descargar avance</button>
    </div>
    <p className="mb-3 text-xs text-zinc-500" aria-live="polite">Paso {paso+1} de {total}. Puedes omitir preguntas.</p>
    <section className="rounded-2xl bg-white p-5 ring-1 ring-zinc-200 sm:p-7">
      <h2 ref={titulo} tabIndex={-1} className="mb-5 text-lg font-semibold text-zinc-900 outline-none">{paso === 0 ? "Tus datos" : paso === total-1 ? "Devolver tus respuestas" : secciones[paso-1]}</h2>
      {paso === 0 ? <div className="space-y-4">
        <label className="block text-sm text-zinc-700">Nombre completo<input className={input} value={nombre} maxLength={200} autoComplete="name" onChange={e => setNombre(e.target.value)} /></label>
        <label className="block text-sm text-zinc-700">Fecha de nacimiento (opcional)<input className={input} type="date" value={nacimiento} autoComplete="bday" onChange={e => setNacimiento(e.target.value)} /></label>
        <label className="block text-sm text-zinc-700">Sexo (opcional)<select className={input} value={sexo ?? ""} onChange={e => setSexo(e.target.value ? e.target.value as "F"|"M" : null)}><option value="">Sin responder</option><option value="F">Femenino</option><option value="M">Masculino</option></select></label>
      </div> : paso === total-1 ? <div className="space-y-4">
        <p className="text-sm text-zinc-700">Responde a tu conversación con el consultorio. Puedes compartir el archivo o copiar el texto; la asistente lo revisará contigo.</p>
        <p className="text-sm text-zinc-600">Nombre declarado: {nombre || "Pendiente"}. Respuestas: {Object.keys(valores).filter(id => campoVisible(campos.find(c => c.id === id)!, valores, sexo) && valores[id] != null && valores[id] !== "").length}.</p>
        <div className="flex flex-wrap gap-2"><button type="button" className={boton} onClick={() => void devolver(true)}>Compartir archivo</button><button type="button" className={boton} onClick={() => void copiar()}>Copiar respuestas</button></div>
        {texto && <label className="block text-sm text-zinc-700">Texto para tu chat<textarea readOnly value={texto} className={`${input} min-h-48`} onFocus={e => e.target.select()} /></label>}
      </div> : <CamposHistoria campos={campos.filter(c => c.seccion === secciones[paso-1])} valores={valores} sexo={sexo} onChange={(id,v) => setValores(prev => ({ ...prev, [id]: v }))} prefijo="remoto" mostrarSeccion={false} />}
      <nav aria-label="Pasos del formulario" className="mt-6 flex justify-between gap-3"><button type="button" className={boton} disabled={paso===0} onClick={() => cambiarPaso(paso-1)}>Anterior</button><button type="button" className={boton} disabled={paso===total-1} onClick={() => cambiarPaso(paso+1)}>Siguiente</button></nav>
    </section>
    {mensaje && <p role="status" className="mt-4 rounded-lg bg-stone-100 p-4 text-sm text-zinc-800">{mensaje}</p>}
  </main>;
}
