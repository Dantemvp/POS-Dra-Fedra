"use client";

import { useActionState, useState } from "react";
import { crearPaciente, type Result } from "./actions";

const inicial: Result = { ok: false };
const input =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900";
const label = "mb-1 block text-xs font-medium text-zinc-600";

export default function NuevoPaciente() {
  const [abierto, setAbierto] = useState(false);
  const [state, action, pending] = useActionState(crearPaciente, inicial);

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="mb-6 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
      >
        + Nuevo paciente
      </button>
    );
  }

  return (
    <div className="mb-6 rounded-xl bg-white p-4 ring-1 ring-zinc-200">
      <form action={action} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={label}>Nombre *</label>
            <input name="nombre" required className={input} />
          </div>
          <div>
            <label className={label}>Apellidos</label>
            <input name="apellidos" className={input} />
          </div>
          <div>
            <label className={label}>Fecha de nacimiento</label>
            <input name="fecha_nac" type="date" className={input} />
          </div>
          <div>
            <label className={label}>Sexo</label>
            <select name="sexo" className={input} defaultValue="">
              <option value="">—</option>
              <option value="F">Femenino</option>
              <option value="M">Masculino</option>
            </select>
          </div>
          <div>
            <label className={label}>WhatsApp</label>
            <input name="telefono_wpp" className={input} placeholder="55 1234 5678" />
          </div>
          <div>
            <label className={label}>Correo</label>
            <input name="email" type="email" className={input} />
          </div>
        </div>

        <div>
          <label className={label}>Dirección *</label>
          <input
            name="direccion"
            required
            className={input}
            placeholder="Calle, número, colonia, ciudad"
          />
          <p className="mt-1 text-[11px] text-zinc-400">
            Requerida por COFEPRIS para la venta de medicamento controlado.
          </p>
        </div>

        {state.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        )}
        {state.ok && (
          <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
            Paciente guardado.
          </p>
        )}

        <div className="flex gap-2">
          <button
            disabled={pending}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {pending ? "Guardando…" : "Guardar paciente"}
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
