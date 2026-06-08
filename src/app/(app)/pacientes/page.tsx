import { createClient } from "@/lib/supabase/server";
import NuevoPaciente from "./NuevoPaciente";
import ListaPacientes, { type PacienteLista } from "./ListaPacientes";

export default async function PacientesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pacientes")
    .select("id, nombre, apellidos, telefono_wpp, creado_en")
    .order("nombre");

  // Fase actual de cada paciente = fase de su última receta con fase.
  const { data: recs } = await supabase
    .from("recetas")
    .select("paciente_id, fase, fecha")
    .not("fase", "is", null)
    .order("fecha", { ascending: false });
  const faseDe = new Map<string, number>();
  for (const r of (recs ?? []) as { paciente_id: string; fase: number }[]) {
    if (!faseDe.has(r.paciente_id)) faseDe.set(r.paciente_id, r.fase);
  }

  const pacientes: PacienteLista[] = (
    (data ?? []) as Omit<PacienteLista, "fase">[]
  ).map((p) => ({ ...p, fase: faseDe.get(p.id) ?? null }));

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-1 text-2xl font-semibold text-zinc-900">Pacientes</h1>
      <p className="mb-6 text-sm text-zinc-500">{pacientes.length} registrados</p>

      <NuevoPaciente />

      <ListaPacientes pacientes={pacientes} />
    </div>
  );
}
