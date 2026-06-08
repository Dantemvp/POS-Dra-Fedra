import { getUsuarioActual } from "@/lib/auth";
import NotificacionesClient from "./NotificacionesClient";

export const metadata = { title: "Notificaciones — Sistema Fedra" };

export default async function NotificacionesPage() {
  const usuario = await getUsuarioActual();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-semibold text-zinc-900">Notificaciones</h1>
      <p className="mb-6 text-sm text-zinc-500">
        Activa los avisos en tu celular: caducidades, stock bajo, citas del día y
        el resumen de ventas al cierre. Funciona aunque la app esté cerrada.
      </p>

      <NotificacionesClient />

      <div className="mt-6 rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600 ring-1 ring-zinc-200">
        <p className="font-medium text-zinc-800">¿Qué avisos llegan?</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>💊 Productos por caducar y stock bajo (cada mañana).</li>
          <li>📅 Pacientes y citas del día (cada mañana).</li>
          <li>🧾 Resumen de ventas y cobros al cierre del día.</li>
        </ul>
        <p className="mt-3 text-xs text-zinc-500">
          Actívalas en cada dispositivo donde las quieras recibir (el celular de la
          Dra., por ejemplo). En iPhone, primero instala la app a la pantalla de
          inicio.
        </p>
      </div>

      {usuario?.rol !== "admin" && usuario?.rol !== "doctora" && (
        <p className="mt-4 text-xs text-zinc-400">
          Nota: los resúmenes y alertas de inventario se envían al personal
          autorizado (Dra. y administración).
        </p>
      )}
    </div>
  );
}
