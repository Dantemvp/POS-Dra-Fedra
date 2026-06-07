"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import {
  crearUsuario,
  resetearPassword,
  cambiarRol,
  toggleActivo,
  type Result,
} from "./actions";

export type UsuarioRow = {
  id: string;
  auth_uid: string;
  nombre: string;
  email: string;
  rol: string;
  activo: boolean;
  creado_en: string;
};

const ROLES = [
  { v: "admin", l: "Admin" },
  { v: "doctora", l: "Doctora" },
  { v: "asistente", l: "Asistente" },
  { v: "farmacia", l: "Farmacia" },
];

const inicial: Result = { ok: false };

function Fila({
  u,
  esYo,
  onChange,
}: {
  u: UsuarioRow;
  esYo: boolean;
  onChange: () => void;
}) {
  const [reset, setReset] = useState(false);
  const [pwd, setPwd] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function guardarReset() {
    setBusy(true);
    setMsg("");
    const r = await resetearPassword(u.auth_uid, pwd);
    setBusy(false);
    if (!r.ok) {
      setMsg(r.error ?? "Error");
      return;
    }
    setMsg(`Contraseña actualizada: ${pwd}`);
    setReset(false);
    setPwd("");
  }

  async function rol(nuevo: string) {
    setBusy(true);
    await cambiarRol(u.id, nuevo);
    setBusy(false);
    onChange();
  }

  async function activar() {
    setBusy(true);
    const r = await toggleActivo(u.id, u.auth_uid, !u.activo);
    setBusy(false);
    if (!r.ok) setMsg(r.error ?? "Error");
    else onChange();
  }

  return (
    <div className={`rounded-xl bg-white p-4 ring-1 ring-zinc-200 ${u.activo ? "" : "opacity-60"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-zinc-900">
            {u.nombre}
            {esYo && <span className="ml-2 text-xs text-zinc-400">(tú)</span>}
            {!u.activo && (
              <span className="ml-2 rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] uppercase text-zinc-600">
                inactivo
              </span>
            )}
          </p>
          <p className="text-sm text-zinc-500">{u.email}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={u.rol}
            disabled={busy || esYo}
            onChange={(e) => rol(e.target.value)}
            className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm disabled:opacity-50"
          >
            {ROLES.map((r) => (
              <option key={r.v} value={r.v}>
                {r.l}
              </option>
            ))}
          </select>
          <button
            onClick={() => setReset((v) => !v)}
            className="rounded-lg px-2 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
          >
            Resetear contraseña
          </button>
          {!esYo && (
            <button
              onClick={activar}
              disabled={busy}
              className={`rounded-lg px-2 py-1.5 text-sm disabled:opacity-50 ${
                u.activo
                  ? "text-red-600 hover:bg-red-50"
                  : "text-green-700 hover:bg-green-50"
              }`}
            >
              {u.activo ? "Desactivar" : "Activar"}
            </button>
          )}
        </div>
      </div>

      {reset && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3">
          <input
            type="text"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            placeholder="Nueva contraseña (mín. 8)"
            className="flex-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm"
          />
          <button
            onClick={guardarReset}
            disabled={busy || pwd.length < 8}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            Guardar
          </button>
        </div>
      )}
      {msg && (
        <p className="mt-2 text-sm font-medium text-zinc-700">{msg}</p>
      )}
    </div>
  );
}

export default function UsuariosClient({
  usuarios,
  miAuthUid,
}: {
  usuarios: UsuarioRow[];
  miAuthUid: string;
}) {
  const router = useRouter();
  const [estado, accion, pending] = useActionState(crearUsuario, inicial);

  return (
    <div className="space-y-6">
      <form
        action={accion}
        className="space-y-3 rounded-xl bg-white p-5 ring-1 ring-zinc-200"
      >
        <h2 className="text-sm font-medium text-zinc-900">Nueva persona</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            name="nombre"
            required
            placeholder="Nombre completo"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            name="email"
            type="email"
            required
            placeholder="correo@ejemplo.com"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            name="password"
            type="text"
            required
            minLength={8}
            placeholder="Contraseña (mín. 8) — la compartes con la persona"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
          <select
            name="rol"
            defaultValue="asistente"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          >
            {ROLES.map((r) => (
              <option key={r.v} value={r.v}>
                {r.l}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <button
            disabled={pending}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            {pending ? "Creando…" : "Crear usuario"}
          </button>
          {estado.error && (
            <span className="text-sm text-red-600">{estado.error}</span>
          )}
          {estado.ok && (
            <span className="text-sm text-green-700">Usuario creado ✓</span>
          )}
        </div>
      </form>

      <div className="space-y-3">
        {usuarios.map((u) => (
          <Fila
            key={u.id}
            u={u}
            esYo={u.auth_uid === miAuthUid}
            onChange={() => router.refresh()}
          />
        ))}
      </div>
    </div>
  );
}
