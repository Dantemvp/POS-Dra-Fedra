import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AjustadorReceta from "./AjustadorReceta";

type Item = {
  id: string;
  medicamento: string;
  dosis: string | null;
  duracion_dias: number | null;
  indicaciones: string | null;
};
type Receta = {
  id: string;
  folio: number;
  fecha: string;
  fase: number | null;
  ajustes_impresion: Record<string, unknown> | null;
  metricas: Record<string, unknown> | null;
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
      "id, folio, fecha, fase, ajustes_impresion, metricas, pacientes(nombre, apellidos, fecha_nac), receta_items(id, medicamento, dosis, duracion_dias, indicaciones)",
    )
    .eq("id", id)
    .order("orden", { referencedTable: "receta_items", ascending: true })
    .single();

  if (!data) notFound();
  const r = data as unknown as Receta;
  const p = r.pacientes;
  const nombre = p ? `${p.nombre} ${p.apellidos ?? ""}`.trim() : "";
  const edad = edadDe(p?.fecha_nac);
  const fecha = new Date(r.fecha).toLocaleDateString("es-MX");

  return (
    <div className="mx-auto max-w-[1500px]">
      {/* El consultorio imprime en la hoja carta completa que ya trae la bandeja
          y la corta a la mitad, igual que hacía el POS viejo desde Acrobat. Por
          eso la página es carta vertical y la receta ocupa los 139.7 mm de
          arriba, a tamaño real. */}
      <style>{`@media print {
        @page { size: letter portrait; margin: 0; }
        .doc-imprimible.print-area { width: 215.9mm; height: 139.7mm; }
      }`}</style>

      <div className="mb-4 no-print">
        <Link
          href="/recetas"
          className="text-sm text-zinc-500 hover:text-zinc-900"
        >
          ← Recetas
        </Link>
      </div>
      <AjustadorReceta recetaId={r.id} nombre={nombre} edad={edad} fecha={fecha} folio={r.folio} fase={r.fase} items={r.receta_items} ajustes={r.ajustes_impresion} metricasReceta={r.metricas} />
    </div>
  );
}
