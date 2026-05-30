import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import NuevoPaciente from "./NuevoPaciente";

type Paciente = {
  id: string;
  nombre: string;
  apellidos: string | null;
  telefono_wpp: string | null;
  creado_en: string;
};

export default async function PacientesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pacientes")
    .select("id, nombre, apellidos, telefono_wpp, creado_en")
    .order("nombre");

  const pacientes = (data ?? []) as Paciente[];

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-1 text-2xl font-semibold text-zinc-900">Pacientes</h1>
      <p className="mb-6 text-sm text-zinc-500">{pacientes.length} registrados</p>

      <NuevoPaciente />

      <div className="overflow-hidden rounded-xl bg-white ring-1 ring-zinc-200">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">WhatsApp</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {pacientes.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-zinc-400">
                  Aún no hay pacientes.
                </td>
              </tr>
            )}
            {pacientes.map((p) => (
              <tr key={p.id} className="hover:bg-zinc-50">
                <td className="px-4 py-3 font-medium text-zinc-900">
                  {p.nombre} {p.apellidos ?? ""}
                </td>
                <td className="px-4 py-3 text-zinc-600">
                  {p.telefono_wpp ?? "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/pacientes/${p.id}`}
                    className="text-sm font-medium text-zinc-700 hover:text-zinc-900"
                  >
                    Ver →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
