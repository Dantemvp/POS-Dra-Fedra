import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AjustadorReceta from "./AjustadorReceta";

type Item = {
  medicamento: string;
  dosis: string | null;
  duracion_dias: number | null;
  indicaciones: string | null;
};
type Receta = {
  folio: number;
  fecha: string;
  fase: number | null;
  pacientes: {
    nombre: string;
    apellidos: string | null;
    fecha_nac: string | null;
  } | null;
  receta_items: Item[];
};

function edadDe(fnac?: string | null): string {
  if (!fnac) return "";
  const d = new Date(fnac);
  if (isNaN(d.getTime())) return "";
  return String(Math.floor((Date.now() - d.getTime()) / 31557600000));
}

export default async function RecetaPrint({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("recetas")
    .select(
      "folio, fecha, fase, pacientes(nombre, apellidos, fecha_nac), receta_items(medicamento, dosis, duracion_dias, indicaciones)",
    )
    .eq("id", id)
    .single();

  if (!data) notFound();
  const r = data as unknown as Receta;
  const p = r.pacientes;
  const nombre = p ? `${p.nombre} ${p.apellidos ?? ""}`.trim() : "";
  const edad = edadDe(p?.fecha_nac);
  const fecha = new Date(r.fecha).toLocaleDateString("es-MX");

  return (
    <div className="mx-auto max-w-4xl">
      {/* Tamaño media carta horizontal solo al imprimir */}
      <style>{`@media print { @page { size: 8.5in 5.5in; margin: 0; } }`}</style>

      <div className="mb-4 no-print">
        <Link
          href="/recetas"
          className="text-sm text-zinc-500 hover:text-zinc-900"
        >
          ← Recetas
        </Link>
      </div>
      <AjustadorReceta nombre={nombre} edad={edad} fecha={fecha} folio={r.folio} fase={r.fase} items={r.receta_items} />
    </div>
  );
}
