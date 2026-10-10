"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { editarPaciente } from "../actions";

type Datos = { id: string; nombre: string; apellidos: string | null; telefono_wpp: string | null };

export default function EditarPaciente({ paciente }: { paciente: Datos }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [pending, startTransition] = useTransition();
  function guardar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const datos = Object.fromEntries(new FormData(event.currentTarget));
    setMensaje("");
    startTransition(async () => {
      try {
        const resultado = await editarPaciente(paciente.id, paciente, datos);
        if (!resultado.ok) { setMensaje(resultado.error ?? "No se pudo guardar."); return; }
        setAbierto(false);
        router.refresh();
      } catch { setMensaje("No se pudo confirmar el guardado. Recarga antes de volver a intentar."); }
    });
  }
  if (!abierto) return <button type="button" onClick={() => { setMensaje(""); setAbierto(true); }}
    className="mt-4 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white">Editar datos del paciente</button>;
  return <form onSubmit={guardar} className="mt-4 space-y-3 rounded-xl border border-zinc-200 p-4">
    <p className="text-sm text-zinc-600">Corrige sus datos sin cambiar el expediente ni sus documentos vinculados.</p>
    <div className="grid gap-3 sm:grid-cols-2">
      {[["nombre", "Nombre", paciente.nombre], ["apellidos", "Apellidos", paciente.apellidos], ["telefono_wpp", "WhatsApp", paciente.telefono_wpp]].map(([name, etiqueta, valor]) =>
        <label key={name} className="block text-sm text-zinc-700">{etiqueta}
          <input name={name!} defaultValue={valor ?? ""} required={name === "nombre"} type={name === "telefono_wpp" ? "tel" : "text"}
            maxLength={name === "nombre" ? 150 : name === "apellidos" ? 200 : 25} disabled={pending}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900" />
        </label>)}
    </div>
    {mensaje && <p role="alert" className="text-sm text-red-700">{mensaje}</p>}
    <div className="flex gap-3">
      <button disabled={pending} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Guardando…" : "Guardar datos"}</button>
      <button type="button" disabled={pending} onClick={() => setAbierto(false)} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700">Cancelar</button>
    </div>
  </form>;
}
