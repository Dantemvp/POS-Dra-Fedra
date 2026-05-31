import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import NuevaReceta from "./NuevaReceta";

type Receta = {
  id: string;
  folio: number;
  fecha: string;
  fase: number | null;
  pacientes: { nombre: string; apellidos: string | null } | null;
};

export default async function RecetasPage() {
  const supabase = await createClient();

  const { data: pacientesData } = await supabase
    .from("pacientes")
    .select("id, nombre, apellidos")
    .order("nombre");

  const pacientes = (pacientesData ?? []).map((p) => ({
    id: p.id as string,
    nombre: `${p.nombre}${p.apellidos ? " " + p.apellidos : ""}`,
  }));

  const { data: recetasData } = await supabase
    .from("recetas")
    .select("id, folio, fecha, fase, pacientes(nombre, apellidos)")
    .order("fecha", { ascending: false })
    .limit(50);

  const recetas = (recetasData ?? []) as unknown as Receta[];

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-1 text-2xl font-semibold text-zinc-900">Recetas</h1>
      <p className="mb-6 text-sm text-zinc-500">
        Genera una receta pre-llenada lista para imprimir.
      </p>

      <NuevaReceta pacientes={pacientes} />

      <div className="overflow-hidden rounded-xl bg-white ring-1 ring-zinc-200">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3">Folio</th>
              <th className="px-4 py-3">Paciente</th>
              <th className="px-4 py-3">Fase</th>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {recetas.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-400">
                  Sin recetas aún.
                </td>
              </tr>
            )}
            {recetas.map((r) => (
              <tr key={r.id} className="hover:bg-zinc-50">
                <td className="px-4 py-3 font-medium text-zinc-900">#{r.folio}</td>
                <td className="px-4 py-3 text-zinc-700">
                  {r.pacientes
                    ? `${r.pacientes.nombre} ${r.pacientes.apellidos ?? ""}`
                    : "—"}
                </td>
                <td className="px-4 py-3 text-zinc-600">
                  {r.fase ? `Fase ${r.fase}` : "—"}
                </td>
                <td className="px-4 py-3 text-zinc-600">
                  {new Date(r.fecha).toLocaleDateString("es-MX")}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/recetas/${r.id}`}
                    className="text-sm font-medium text-zinc-700 hover:text-zinc-900"
                  >
                    Imprimir →
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
