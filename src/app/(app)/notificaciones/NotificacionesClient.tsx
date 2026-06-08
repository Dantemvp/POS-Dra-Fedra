"use client";

import { useEffect, useState } from "react";
import {
  guardarSuscripcion,
  eliminarSuscripcion,
  enviarPrueba,
} from "./actions";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export default function NotificacionesClient() {
  const [soportado, setSoportado] = useState(true);
  const [suscrito, setSuscrito] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [trabajando, setTrabajando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; txt: string } | null>(
    null,
  );
  const [esIOS, setEsIOS] = useState(false);
  const [instalada, setInstalada] = useState(true);

  useEffect(() => {
    const ios =
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !("MSStream" in window);
    setEsIOS(ios);
    setInstalada(
      window.matchMedia("(display-mode: standalone)").matches ||
        // iOS Safari instalado:
        (window.navigator as unknown as { standalone?: boolean }).standalone === true,
    );

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setSoportado(false);
      setCargando(false);
      return;
    }
    (async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
        const sub = await reg.pushManager.getSubscription();
        setSuscrito(!!sub);
      } catch {
        setSoportado(false);
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  async function activar() {
    setTrabajando(true);
    setMensaje(null);
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") {
        setMensaje({
          tipo: "error",
          txt: "Permiso denegado. Actívalo en los ajustes del navegador.",
        });
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
        ),
      });
      const json = JSON.parse(JSON.stringify(sub));
      const r = await guardarSuscripcion(json, navigator.userAgent);
      if (!r.ok) {
        setMensaje({ tipo: "error", txt: r.error ?? "No se pudo guardar." });
        return;
      }
      setSuscrito(true);
      setMensaje({ tipo: "ok", txt: "¡Listo! Este dispositivo recibirá notificaciones." });
    } catch (e) {
      setMensaje({
        tipo: "error",
        txt: "No se pudo activar: " + (e instanceof Error ? e.message : "error"),
      });
    } finally {
      setTrabajando(false);
    }
  }

  async function desactivar() {
    setTrabajando(true);
    setMensaje(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await eliminarSuscripcion(sub.endpoint);
        await sub.unsubscribe();
      }
      setSuscrito(false);
      setMensaje({ tipo: "ok", txt: "Notificaciones desactivadas en este dispositivo." });
    } finally {
      setTrabajando(false);
    }
  }

  async function probar() {
    setTrabajando(true);
    setMensaje(null);
    const r = await enviarPrueba();
    setMensaje(
      r.ok
        ? { tipo: "ok", txt: "Notificación enviada. Revisa tu pantalla." }
        : { tipo: "error", txt: r.error ?? "No se pudo enviar." },
    );
    setTrabajando(false);
  }

  if (cargando) {
    return <p className="text-sm text-zinc-500">Cargando…</p>;
  }

  if (!soportado) {
    return (
      <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-200">
        Este navegador no soporta notificaciones push.
        {esIOS && !instalada && (
          <p className="mt-2">
            En iPhone primero debes <strong>instalar la app</strong> (ver abajo).
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Aviso iOS: debe instalarse a la pantalla de inicio */}
      {esIOS && !instalada && (
        <div className="rounded-xl bg-blue-50 p-4 text-sm text-blue-900 ring-1 ring-blue-200">
          <p className="font-medium">📱 En iPhone, instala la app primero</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>
              Toca el botón <strong>Compartir</strong> <span aria-hidden>⎋</span> en
              Safari.
            </li>
            <li>
              Elige <strong>«Agregar a pantalla de inicio»</strong> <span aria-hidden>➕</span>.
            </li>
            <li>Abre la app desde el ícono nuevo y regresa a esta pantalla.</li>
          </ol>
        </div>
      )}

      <div className="rounded-xl bg-white p-5 ring-1 ring-zinc-200">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium text-zinc-900">
              Notificaciones en este dispositivo
            </p>
            <p className="text-sm text-zinc-500">
              {suscrito
                ? "Activadas. Recibirás avisos aunque la app esté cerrada."
                : "Desactivadas en este dispositivo."}
            </p>
          </div>
          <span
            className={`inline-flex h-2.5 w-2.5 rounded-full ${
              suscrito ? "bg-green-500" : "bg-zinc-300"
            }`}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {suscrito ? (
            <>
              <button
                onClick={probar}
                disabled={trabajando}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                Enviar prueba
              </button>
              <button
                onClick={desactivar}
                disabled={trabajando}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                Desactivar
              </button>
            </>
          ) : (
            <button
              onClick={activar}
              disabled={trabajando}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {trabajando ? "Activando…" : "Activar notificaciones"}
            </button>
          )}
        </div>

        {mensaje && (
          <p
            className={`mt-3 text-sm ${
              mensaje.tipo === "ok" ? "text-green-700" : "text-red-600"
            }`}
          >
            {mensaje.txt}
          </p>
        )}
      </div>
    </div>
  );
}
