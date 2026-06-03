import { createClient } from "@/lib/supabase/server";
import NuevoPaciente from "./NuevoPaciente";
import ListaPacientes, { type PacienteLista } from "./ListaPacientes";

export default async function PacientesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pacientes")
    .select("id, nombre, apellidos, telefono_wpp")
    .order("nombre");

  const pacientes = (data ?? []) as PacienteLista[];

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-1 text-2xl font-semibold text-zinc-900">Pacientes</h1>
      <p className="mb-6 text-sm text-zinc-500">{pacientes.length} registrados</p>

      <NuevoPaciente />

      <ListaPacientes pacientes={pacientes} />
    </div>
  );
}
