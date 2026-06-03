import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PrintButton from "./PrintButton";

type Campo = { id: string; etiqueta: string; seccion: string | null; orden: number };
type Historia = {
  fecha: string;
  datos: Record<string, unknown>;
  pacientes: {
    nombre: string;
    apellidos: string | null;
    fecha_nac: string | null;
    sexo: string | null;
    telefono_wpp: string | null;
  } | null;
  tipos_historia: { id: string; nombre: string } | null;
};

function valor(v: unknown): string {
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (Array.isArray(v)) return v.join(", ");
  return String(v ?? "").trim();
}

export default async function HistoriaPrint({
  params,
}: {
  params: Promise<{ hid: string }>;
}) {
  const { hid } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("historias_clinicas")
    .select(
      "fecha, datos, pacientes(nombre, apellidos, fecha_nac, sexo, telefono_wpp), tipos_historia(id, nombre)",
    )
    .eq("id", hid)
    .single();

  if (!data) notFound();
  const h = data as unknown as Historia;
  const p = h.pacientes;
  const datos = h.datos ?? {};

  // Campos de la plantilla (para etiquetas + secciones + orden)
  const { data: camposData } = await supabase
    .from("campos_historia")
    .select("id, etiqueta, seccion, orden")
    .eq("tipo_historia_id", h.tipos_historia?.id ?? "")
    .order("orden");
  const campos = (camposData ?? []) as Campo[];

  // Construir secciones ordenadas a partir de los campos con valor
  const usados = new Set<string>();
  const secciones: { nombre: string; filas: [string, string][] }[] = [];
  for (const c of campos) {
    const v = datos[c.id];
    if (v === undefined || v === null || valor(v) === "") continue;
    usados.add(c.id);
    const sec = c.seccion ?? "Datos";
    let grupo = secciones.find((s) => s.nombre === sec);
    if (!grupo) {
      grupo = { nombre: sec, filas: [] };
      secciones.push(grupo);
    }
    grupo.filas.push([c.etiqueta, valor(v)]);
  }
  // Claves que no corresponden a un campo (ej. InBody con etiquetas legibles)
  const extra: [string, string][] = Object.entries(datos)
    .filter(([k, v]) => !usados.has(k) && valor(v) !== "")
    .map(([k, v]) => [k, valor(v)]);
  if (extra.length > 0) secciones.push({ nombre: "Datos", filas: extra });

  const fechaTxt = new Date(h.fecha).toLocaleDateString("es-MX");

  return (
    <div className="mx-auto max-w-3xl">
      <style>{`
        @media print {
          @page { size: letter; margin: 12mm 14mm; }
          html, body { margin: 0 !important; background: #fff !important; }
          main { padding: 0 !important; }
          .hc-doc, .hc-doc * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        .hc-table { width: 100%; border-collapse: collapse; }
        .hc-table td { vertical-align: top; }
      `}</style>

      <div className="mb-4 flex items-center justify-between no-print">
        <Link
          href={p ? "/pacientes" : "#"}
          className="text-sm text-zinc-500 hover:text-zinc-900"
        >
          ← Pacientes
        </Link>
        <PrintButton />
      </div>

      {/* Documento paginado: el encabezado (logo + datos) y el pie (contacto)
          son thead/tfoot, que el navegador REPITE en cada hoja al imprimir.
          El contenido fluye en medio y cruza de página como un Word; la firma
          va una sola vez al final. */}
      <div className="hc-doc mx-auto max-w-3xl bg-white p-8 ring-1 ring-zinc-200 print:p-0 print:ring-0">
        <table className="hc-table">
          <thead>
            <tr>
              <td>
                {/* Membrete (se repite en cada página) */}
                <div
                  className="flex items-start justify-between border-b-2 pb-3"
                  style={{ borderColor: "#b8aa9c" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/logo.png"
                    alt="Dra. Fedra Aldama"
                    style={{ width: 210, height: "auto" }}
                  />
                  <div className="text-right text-[10px] leading-snug text-zinc-600">
                    <p className="font-semibold text-zinc-800">
                      Dra. Fedra Yarissa Aldama Castro
                    </p>
                    <p>Médico Cirujano — U. Autónoma de Guadalajara</p>
                    <p>Céd. Prof. 11015233 · S.S.A. 20982</p>
                  </div>
                </div>
                <div style={{ height: "10px" }} />
              </td>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <div className="text-center">
                  <h1 className="text-base font-semibold tracking-wide text-zinc-900">
                    HISTORIA CLÍNICA
                  </h1>
                  <p className="text-[11px] text-zinc-500">
                    {h.tipos_historia?.nombre ?? ""}
                  </p>
                </div>

                <div className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-0.5 text-[11px] text-zinc-700">
                  <span>
                    <span className="text-zinc-400">Paciente: </span>
                    {p ? `${p.nombre} ${p.apellidos ?? ""}` : "—"}
                  </span>
                  {p?.sexo && <span>Sexo: {p.sexo}</span>}
                  {p?.fecha_nac && <span>Nac.: {p.fecha_nac}</span>}
                  <span>
                    <span className="text-zinc-400">Fecha: </span>
                    {fechaTxt}
                  </span>
                </div>

                <div className="mt-3 space-y-3">
                  {secciones.map((s) => (
                    <section key={s.nombre} className="break-inside-avoid">
                      <h2 className="mb-1 border-b border-[#cbbfae] pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#9a8c7a]">
                        {s.nombre}
                      </h2>
                      <dl className="grid grid-cols-1 gap-x-8 gap-y-0.5 text-[11px] sm:grid-cols-2">
                        {s.filas.map(([k, v], i) => (
                          <div
                            key={i}
                            className="flex justify-between gap-3 border-b border-zinc-100 py-0.5"
                          >
                            <dt className="text-zinc-500">{k}</dt>
                            <dd className="text-right font-medium text-zinc-800">
                              {v}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </section>
                  ))}
                  {secciones.length === 0 && (
                    <p className="text-sm text-zinc-400">
                      Esta historia no tiene datos.
                    </p>
                  )}
                </div>

                {/* Firma (una sola vez, al final) */}
                <div className="mt-12 break-inside-avoid text-center">
                  <div className="mx-auto w-60 border-t border-zinc-500" />
                  <p className="mt-1 text-[11px] font-semibold text-zinc-800">
                    Dra. Fedra Yarissa Aldama Castro
                  </p>
                  <p className="text-[10px] text-zinc-500">
                    Médico Cirujano · Céd. Prof. 11015233 · S.S.A. 20982
                  </p>
                </div>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td>
                {/* Pie (se repite en cada página) */}
                <div
                  className="mt-3 border-t pt-1 text-center text-[9px] text-zinc-500"
                  style={{ borderColor: "#cbbfae" }}
                >
                  Tel. 668 146 35 02 · Blvd Río Fuerte 2677, Viñedos · Los
                  Mochis, Sin.
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
