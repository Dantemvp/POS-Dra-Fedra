import { createClient } from "@/lib/supabase/server";
import NuevaReceta from "./NuevaReceta";
import ListaRecetas, { type RecetaLista } from "./ListaRecetas";

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

  // Productos del inventario: sugerencias al escribir el medicamento (sin
  // perder la opción de escribir libre).
  const { data: productosData } = await supabase
    .from("productos")
    .select("id, nombre")
    .eq("activo", true)
    .order("nombre");
  const productos = (productosData ?? []).map((p) => ({
    id: p.id as string,
    nombre: p.nombre as string,
  }));

  const { data: recetasData } = await supabase
    .from("recetas")
    .select("id, folio, fecha, fase, pacientes(nombre, apellidos)")
    .order("fecha", { ascending: false })
    .limit(2000);

  const recetas: RecetaLista[] = ((recetasData ?? []) as unknown as Receta[]).map(
    (r) => ({
      id: r.id,
      folio: r.folio,
      fecha: r.fecha,
      fase: r.fase,
      paciente: r.pacientes
        ? `${r.pacientes.nombre} ${r.pacientes.apellidos ?? ""}`.trim()
        : "—",
    }),
  );

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-1 text-2xl font-semibold text-zinc-900">Recetas</h1>
      <p className="mb-6 text-sm text-zinc-500">
        Genera una receta pre-llenada lista para imprimir.
      </p>

      <NuevaReceta pacientes={pacientes} productos={productos} />

      <ListaRecetas recetas={recetas} />
    </div>
  );
}
