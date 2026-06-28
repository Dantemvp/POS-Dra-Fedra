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
  metricas: Record<string, string> | null;
  pacientes: {
    nombre: string;
    apellidos: string | null;
    fecha_nac: string | null;
  } | null;
  receta_items: Item[];
};

// Posición vertical (% del alto) de cada métrica en el recetario.
const METRICA_TOP: Record<string, number> = {
  peso: 29.8,
  estatura: 33.6,
  imc: 37.3,
  peso_ideal: 41.1,
  peso_sugerido: 44.9,
  cintura: 48.5,
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
      "folio, fecha, fase, metricas, pacientes(nombre, apellidos, fecha_nac), receta_items(medicamento, dosis, duracion_dias, indicaciones)",
    )
    .eq("id", id)
    .single();

  if (!data) notFound();
  const r = data as unknown as Receta;
  const p = r.pacientes;
  const nombre = p ? `${p.nombre} ${p.apellidos ?? ""}`.trim() : "";
  const edad = edadDe(p?.fecha_nac);
  const fecha = new Date(r.fecha).toLocaleDateString("es-MX");
  const metricas = r.metricas ?? {};

  return (
    <div className="mx-auto max-w-4xl">
      {/* Tamaño media carta horizontal solo al imprimir */}
      <style>{`@media print { @page { size: 8.5in 5.5in; margin: 0; } }`}</style>

      <div className="mb-4 flex items-center justify-between no-print">
        <Link
          href="/recetas"
          className="text-sm text-zinc-500 hover:text-zinc-900"
        >
          ← Recetas
        </Link>
        <PrintButton />
      </div>

      <div
        className="print-area doc-imprimible relative mx-auto w-full bg-white text-zinc-900"
        style={{
          aspectRatio: "2000 / 1294",
          containerType: "inline-size",
        }}
      >
        {/* Recetario de fondo como <img>: las imágenes SÍ se imprimen aunque
            el usuario no marque "Gráficos en segundo plano" (a diferencia de
            background-image de CSS, que el navegador omite al imprimir). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/recetario.png"
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "fill",
          }}
        />

        {/* Nombre / Edad / Fecha (texto JUSTO ARRIBA de la línea) */}
        <span style={{ position: "absolute", left: "10%", top: "18.2%", fontSize: "1.6cqw" }}>
          {nombre}
        </span>
        <span style={{ position: "absolute", left: "50%", top: "18.2%", fontSize: "1.6cqw" }}>
          {edad}
        </span>
        <span style={{ position: "absolute", left: "71%", top: "18.2%", fontSize: "1.6cqw" }}>
          {fecha}
        </span>

        {/* Métricas (columna derecha) */}
        {Object.entries(METRICA_TOP).map(([k, top]) =>
          metricas[k] ? (
            <span
              key={k}
              style={{
                position: "absolute",
                left: "82%",
                top: `${top}%`,
                fontSize: "1.5cqw",
              }}
            >
              {metricas[k]}
            </span>
          ) : null,
        )}

        {/* Rp / medicamentos */}
        <div
          style={{
            position: "absolute",
            left: "5%",
            top: "30%",
            width: "53%",
            fontSize: "1.5cqw",
            lineHeight: 1.35,
          }}
        >
          {r.fase ? (
            <p style={{ marginBottom: "0.6cqw", color: "#6b7280" }}>
              Fase {r.fase} del tratamiento
            </p>
          ) : null}
          <ol style={{ display: "flex", flexDirection: "column", gap: "0.8cqw" }}>
            {r.receta_items.map((it, i) => (
              <li key={i}>
                <div style={{ fontWeight: 600 }}>
                  {i + 1}. {it.medicamento}
                </div>
                <div
                  style={{
                    color: "#52525b",
                    paddingLeft: "1.4cqw",
                    whiteSpace: "pre-line", // respeta saltos de línea en dosis/indicaciones
                  }}
                >
                  {[
                    it.dosis,
                    it.duracion_dias ? `${it.duracion_dias} días` : null,
                    it.indicaciones,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Folio (discreto) */}
        <span
          style={{
            position: "absolute",
            left: "3.5%",
            top: "95.5%",
            fontSize: "1.05cqw",
            color: "#a1a1aa",
          }}
        >
          Folio #{r.folio}
        </span>
      </div>
    </div>
  );
}
