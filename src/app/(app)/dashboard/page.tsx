import { getUsuarioActual } from "@/lib/auth";

export default async function DashboardPage() {
  const usuario = await getUsuarioActual();

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold text-zinc-900">
        Hola, {usuario?.nombre}
      </h1>
      <p className="mt-1 text-zinc-500">
        Bienvenida al sistema de Dra. Fedra Aldama.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-white p-5 ring-1 ring-zinc-200">
          <p className="text-sm text-zinc-500">Fase actual</p>
          <p className="mt-1 text-lg font-semibold text-zinc-900">
            Farmacia — Inventario
          </p>
        </div>
        <div className="rounded-xl bg-white p-5 ring-1 ring-zinc-200">
          <p className="text-sm text-zinc-500">Tu rol</p>
          <p className="mt-1 text-lg font-semibold capitalize text-zinc-900">
            {usuario?.rol}
          </p>
        </div>
        <div className="rounded-xl bg-white p-5 ring-1 ring-zinc-200">
          <p className="text-sm text-zinc-500">Estado</p>
          <p className="mt-1 text-lg font-semibold text-green-600">Activo</p>
        </div>
      </div>
    </div>
  );
}
