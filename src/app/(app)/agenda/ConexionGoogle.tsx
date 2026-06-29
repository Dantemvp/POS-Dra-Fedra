"use client";

import { useState, useTransition } from "react";
import { desconectarGoogle } from "./google";

// Tarjeta de estado + botón "Conectar/Desconectar Google Calendar". Solo se
// muestra a admin/doctora. La conexión es OAuth (se hace una vez); a partir de
// ahí las citas nuevas aparecen solas en el calendario vinculado.
export default function ConexionGoogle({
  configurado,
  conectado,
  email,
  aviso,
}: {
  configurado: boolean;
  conectado: boolean;
  email: string | null;
  aviso?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(avisoTexto(aviso));

  function desconectar() {
    if (!confirm("¿Desvincular Google Calendar? Las citas nuevas dejarán de sincronizarse."))
      return;
    setMsg(null);
    startTransition(async () => {
      const res = await desconectarGoogle();
      setMsg(res.ok ? "Calendario desvinculado." : res.error ?? "Error.");
    });
  }

  return (
    <div className="mb-4 rounded-xl bg-white p-4 ring-1 ring-zinc-200">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-900">Google Calendar</p>
          {!configurado ? (
            <p className="text-xs text-amber-600">
              Falta configurar las credenciales de Google (Client ID/Secret) en el servidor.
            </p>
          ) : conectado ? (
            <p className="text-xs text-emerald-600">
              Conectado{email ? ` como ${email}` : ""}. Las citas nuevas se agregan al calendario.
            </p>
          ) : (
            <p className="text-xs text-zinc-500">
              Sin conectar. Vincula una cuenta para que las citas aparezcan en Google Calendar.
            </p>
          )}
        </div>

        {configurado &&
          (conectado ? (
            <button
              onClick={desconectar}
              disabled={pending}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              {pending ? "Desvinculando…" : "Desvincular"}
            </button>
          ) : (
            <a
              href="/api/google/oauth/start"
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800"
            >
              Conectar con Google
            </a>
          ))}
      </div>
      {msg && <p className="mt-2 text-xs text-zinc-500">{msg}</p>}
    </div>
  );
}

function avisoTexto(aviso?: string): string | null {
  switch (aviso) {
    case "conectado":
      return "Google Calendar conectado correctamente.";
    case "cancelado":
      return "Conexión cancelada.";
    case "denegado":
      return "Solo admin o doctora pueden conectar el calendario.";
    case "noconfig":
      return "Faltan las credenciales de Google en el servidor.";
    case "sinrefresh":
      return "Google no devolvió permiso permanente. Quita el acceso en tu cuenta de Google e intenta de nuevo.";
    case "error":
      return "No se pudo conectar. Intenta de nuevo.";
    default:
      return null;
  }
}
