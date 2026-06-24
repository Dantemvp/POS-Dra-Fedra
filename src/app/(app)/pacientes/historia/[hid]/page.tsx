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

  const { data: camposData } = await supabase
    .from("campos_historia")
    .select("id, etiqueta, seccion, orden")
    .eq("tipo_historia_id", h.tipos_historia?.id ?? "")
    .order("orden");
  const campos = (camposData ?? []) as Campo[];

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
  const extra: [string, string][] = Object.entries(datos)
    .filter(([k, v]) => !usados.has(k) && valor(v) !== "")
    .map(([k, v]) => [k, valor(v)]);
  if (extra.length > 0) secciones.push({ nombre: "Datos", filas: extra });

  const fechaTxt = new Date(h.fecha).toLocaleDateString("es-MX");

  return (
    <div className="mx-auto max-w-[660px]">
      <style>{`
        /* Documento tamaño carta (612x792 @72dpi). El membrete va de marca de
           agua tenue al fondo y el contenido fluye a TODO el ancho con márgenes,
           igual que la plantilla oficial. */
        .hc-doc {
          position: relative;
          width: 612px;
          min-height: 792px;
          margin: 0 auto;
          background: #fff;
          color: #1c1917;
        }
        .hc-bg {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          z-index: 0;
          pointer-events: none;
        }
        .hc-content {
          position: relative;
          z-index: 1;
          padding: 40px 44px 44px 44px; /* ~0.55in laterales */
        }
        /* Guías de corte de hoja carta (solo en pantalla): una línea cada 792px
           (alto de carta a 72dpi) para que se vea dónde parten las páginas.
           Es una referencia visual; el PDF/impresión dividen exacto por su cuenta. */
        .hc-guias {
          position: absolute;
          inset: 0;
          z-index: 2;
          pointer-events: none;
          background-image: repeating-linear-gradient(
            to bottom,
            transparent 0,
            transparent 790px,
            rgba(140, 122, 99, 0.45) 790px,
            rgba(140, 122, 99, 0.45) 792px
          );
        }

        @media print {
          .hc-guias { display: none !important; }
          /* Margen vertical en CADA hoja (evita que el texto se pegue al cruzar
             de página). Sin margen lateral: el contenido lo controla .hc-content
             y el membrete sangra a todo el ancho. */
          @page { size: letter; margin: 0.55in 0; }
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          main { padding: 0 !important; }
          .no-print { display: none !important; }
          body * { visibility: hidden; }
          .hc-doc, .hc-doc * { visibility: visible !important; }
          .hc-doc { position: static; width: auto; min-height: 0; margin: 0; }
          /* Membrete fijo = se repite en cada hoja, a tamaño carta completo.
             top negativo compensa el margen de @page para sangrar arriba. */
          .hc-bg {
            position: fixed;
            top: -0.55in;
            left: 0;
            width: 8.5in;
            height: 11in;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .hc-content { padding: 0 0.6in !important; }
        }
      `}</style>

      <div className="mb-4 flex items-center justify-between no-print">
        <Link
          href={p ? "/pacientes" : "#"}
          className="text-sm text-zinc-500 hover:text-zinc-900"
        >
          ← Pacientes
        </Link>
        <PrintButton
          filename={`HC-${p ? `${p.nombre} ${p.apellidos ?? ""}`.trim() : "paciente"}-${fechaTxt}`.replace(/[^\w\sáéíóúñ-]/gi, "")}
        />
      </div>

      <div className="hc-doc doc-imprimible ring-1 ring-zinc-200 print:ring-0">
        {/* Membrete oficial — <img> (no background-image) para que imprima */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="hc-bg" src="/membrete-historia.png" alt="" />
        {/* Guías de corte de hoja (solo pantalla) */}
        <div className="hc-guias no-print" aria-hidden />

        <div className="hc-content">
          <div className="hc-body">
          {/* Encabezado: logo + datos de la doctora (como la plantilla oficial) */}
          <div className="flex items-start justify-between gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Dra. Fedra Aldama" style={{ width: 170, height: "auto" }} />
            <div className="text-right text-[8px] leading-tight text-zinc-700">
              <p className="text-[9px] font-semibold text-zinc-900">
                DRA. FEDRA YARISSA ALDAMA CASTRO
              </p>
              <p>Médico Cirujano — Universidad Autónoma de Guadalajara</p>
              <p>Céd. Prof. 11015233 · S.S.A. 20982</p>
              <p>Tel. 668 146 35 02</p>
              <p>Blvd Río Fuerte 2677, Viñedos · Los Mochis, Sin.</p>
            </div>
          </div>

          <div className="mt-2 border-t-2" style={{ borderColor: "#b8aa9c" }} />

          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-[10px] text-zinc-500">
              {h.tipos_historia?.nombre ?? ""}
            </span>
            <h1 className="text-[15px] font-bold tracking-wide text-zinc-900">
              HISTORIA CLÍNICA
            </h1>
            <span className="text-[10px] text-zinc-700">
              <span className="text-zinc-400">Fecha: </span>
              {fechaTxt}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-0.5 border-y border-zinc-200 py-1 text-[10px] text-zinc-800">
            <span>
              <span className="text-zinc-400">Paciente: </span>
              <strong>{p ? `${p.nombre} ${p.apellidos ?? ""}` : "—"}</strong>
            </span>
            {p?.sexo && (
              <span>
                <span className="text-zinc-400">Sexo: </span>
                {p.sexo}
              </span>
            )}
            {p?.fecha_nac && (
              <span>
                <span className="text-zinc-400">Nac.: </span>
                {p.fecha_nac}
              </span>
            )}
            {p?.telefono_wpp && (
              <span>
                <span className="text-zinc-400">Tel.: </span>
                {p.telefono_wpp}
              </span>
            )}
          </div>

          <div className="mt-3 space-y-2.5">
            {secciones.map((s) => (
              <section key={s.nombre} className="break-inside-avoid">
                <h2 className="mb-1 bg-[#f1ebe1] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#8c7a63]">
                  {s.nombre}
                </h2>
                <dl className="grid grid-cols-1 gap-x-8 gap-y-px text-[10px] sm:grid-cols-2">
                  {s.filas.map(([k, v], i) => (
                    <div
                      key={i}
                      className="flex justify-between gap-3 border-b border-dotted border-zinc-300 py-0.5"
                    >
                      <dt className="text-zinc-500">{k}</dt>
                      <dd className="text-right font-medium text-zinc-900">{v}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
            {secciones.length === 0 && (
              <p className="text-sm text-zinc-400">Esta historia no tiene datos.</p>
            )}
          </div>

          {/* Firma */}
          <div className="mt-10 break-inside-avoid text-center">
            <div className="mx-auto w-56 border-t border-zinc-500" />
            <p className="mt-1 text-[10px] font-semibold text-zinc-900">
              Dra. Fedra Yarissa Aldama Castro
            </p>
            <p className="text-[8px] text-zinc-500">
              Médico Cirujano · Céd. Prof. 11015233 · S.S.A. 20982
            </p>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
