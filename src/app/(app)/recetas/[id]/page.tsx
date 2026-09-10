import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PrintButton from "./PrintButton";
import CodigoBarrasReceta from "./CodigoBarrasReceta";

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

        {/* Etiqueta de fase, arriba de la columna derecha.
            La columna de peso, estatura, IMC y cintura se deja EN BLANCO a
            propósito: Fedra anota ahí a mano la evolución de la paciente. El
            sistema no debe imprimir nada debajo de esta etiqueta. */}
        {r.fase ? (
          <div
            style={{
              position: "absolute",
              left: "65.5%",
              top: "21.5%",
              width: "22%",
              padding: "0.6cqw 0",
              textAlign: "center",
              fontSize: "1.6cqw",
              background: "#e7e2da",
              borderRadius: "0.4cqw",
            }}
          >
            FASE {r.fase}
          </div>
        ) : null}

        {/* Medicamentos. Formato de las recetas muestra: cada renglón abre con
            un asterisco, el nombre lleva la duración entre paréntesis, y la
            posología y las aclaraciones van debajo, sangradas y en bloques
            separados. Las aclaraciones NO se reacomodan para caber mejor. */}
        <div
          data-receta-contenido
          style={{
            position: "absolute",
            left: "5%",
            top: "28%",
            width: "53%",
            fontSize: "1.5cqw",
            lineHeight: 1.35,
          }}
        >
          <ul style={{ display: "flex", flexDirection: "column", gap: "1.5cqw" }}>
            {r.receta_items.map((it, i) => (
              <li key={i}>
                <div>
                  <span style={{ paddingRight: "0.6cqw" }}>*</span>
                  {it.medicamento}
                  {it.duracion_dias ? ` (${it.duracion_dias} días)` : ""}
                </div>
                {it.dosis ? (
                  <div
                    style={{
                      paddingLeft: "1.6cqw",
                      whiteSpace: "pre-line", // respeta saltos de línea en la dosificación
                    }}
                  >
                    {it.dosis}
                  </div>
                ) : null}
                {it.indicaciones ? (
                  <div
                    style={{
                      paddingLeft: "1.6cqw",
                      marginTop: "0.6cqw",
                      whiteSpace: "pre-line", // cada aclaración conserva su propio renglón
                    }}
                  >
                    {it.indicaciones}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>

        {/* Inicio de la franja inferior reservada. No se dibuja; el botón de
            impresión la usa para impedir que una receta larga invada el folio
            o el código de barras. */}
        <div
          data-receta-limite
          aria-hidden="true"
          style={{ position: "absolute", left: "5%", top: "82%", width: "53%" }}
        />

        {/* Código de barras del folio: la farmacia lo escanea para cargar los
            medicamentos recetados en el POS. Va abajo a la izquierda, encima
            del folio, lejos de la línea de FIRMA y del área que Fedra escribe
            a mano. El SVG se ajusta al ancho de este contenedor. */}
        <div
          style={{
            position: "absolute",
            left: "3.5%",
            top: "85%",
            width: "20%",
          }}
        >
          <CodigoBarrasReceta folio={r.folio} />
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
