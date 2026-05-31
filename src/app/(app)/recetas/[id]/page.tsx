import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PrintButton from "./PrintButton";

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
  pacientes: { nombre: string; apellidos: string | null; fecha_nac: string | null } | null;
  receta_items: Item[];
};

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
  const paciente = r.pacientes;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between no-print">
        <Link href="/recetas" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← Recetas
        </Link>
        <PrintButton />
      </div>

      {/* Área imprimible — tamaño media carta */}
      <div className="print-area mx-auto bg-white p-8 ring-1 ring-zinc-200">
        <div className="text-center">
          <h1 className="text-lg font-bold text-zinc-900">Dra. Fedra Aldama</h1>
          <p className="text-xs text-zinc-500">
            Medicina estética y control de peso
          </p>
          <p className="text-[10px] text-zinc-400">
            Cédula profesional: ________ · Folio #{r.folio}
          </p>
        </div>

        <div className="my-4 border-t border-zinc-300" />

        <div className="flex justify-between text-sm">
          <div>
            <span className="text-zinc-500">Paciente: </span>
            <span className="font-medium text-zinc-900">
              {paciente ? `${paciente.nombre} ${paciente.apellidos ?? ""}` : "—"}
            </span>
          </div>
          <div className="text-zinc-500">
            {new Date(r.fecha).toLocaleDateString("es-MX")}
          </div>
        </div>
        {r.fase && (
          <p className="mt-1 text-sm text-zinc-600">Fase {r.fase} del tratamiento</p>
        )}

        <div className="my-4 border-t border-zinc-300" />

        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Rp.
        </p>
        <ol className="space-y-3">
          {r.receta_items.map((it, i) => (
            <li key={i} className="text-sm">
              <p className="font-medium text-zinc-900">
                {i + 1}. {it.medicamento}
              </p>
              <p className="ml-4 text-zinc-600">
                {[
                  it.dosis,
                  it.duracion_dias ? `${it.duracion_dias} días` : null,
                  it.indicaciones,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </li>
          ))}
        </ol>

        <div className="mt-12 text-center text-sm">
          <div className="mx-auto w-56 border-t border-zinc-400" />
          <p className="mt-1 text-zinc-600">Firma</p>
        </div>
      </div>
    </div>
  );
}
