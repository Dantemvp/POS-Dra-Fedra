"use client";

import { useActionState, useState } from "react";
import { crearCita, type Result } from "./actions";
import type { PacienteOpcion } from "./page";

const inicial: Result = { ok: false };
const input =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900";
const label = "mb-1 block text-xs font-medium text-zinc-600";

export default function NuevaCita({
  pacientes,
}: {
  pacientes: PacienteOpcion[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [state, action, pending] = useActionState(crearCita, inicial);

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="mb-6 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
      >
        + Nueva cita
      </button>
    );
  }

  return (
    <div className="mb-6 rounded-xl bg-white p-4 ring-1 ring-zinc-200">
      <form action={action} className="space-y-3">
        <div>
          <label className={label}>Paciente *</label>
          <select name="paciente_id" required defaultValue="" className={input}>
            <option value="" disabled>
              Selecciona…
            </option>
            {pacientes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} {p.apellidos ?? ""}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={label}>Fecha *</label>
            <input name="fecha" type="date" required className={input} />
          </div>
          <div>
            <label className={label}>Hora *</label>
            <input name="hora" type="time" required className={input} />
          </div>
        </div>
        <div>
          <label className={label}>Notas</label>
          <input
            name="notas"
            className={input}
            placeholder="Motivo, control, etc."
          />
        </div>

        {state.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        )}
        {state.ok && (
          <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
            Cita agendada.
          </p>
        )}

        <div className="flex gap-2">
          <button
            disabled={pending}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {pending ? "Guardando…" : "Agendar cita"}
          </button>
          <button
            type="button"
            onClick={() => setAbierto(false)}
            className="rounded-lg px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100"
          >
            Cerrar
          </button>
        </div>
      </form>
    </div>
  );
}
