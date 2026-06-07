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
    <div className="mx-auto max-w-[640px]">
      <style>{`
        /* --- Pantalla: vista WYSIWYG tamaño carta (612x792 @72dpi) --- */
        .hc-doc {
          position: relative;
          width: 612px;
          min-height: 792px;
          margin: 0 auto;
          background: #fff;
        }
        .hc-bg {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          z-index: 0;
        }
        /* Zona segura: libra la mancha sup-izq y la inf-der del membrete. */
        .hc-content {
          position: relative;
          z-index: 1;
          padding: 137px 43px 237px 122px; /* top right bottom left @72dpi */
        }

        /* --- Impresión: hoja carta exacta, membrete llenando 8.5x11in --- */
        @media print {
          @page { size: letter; margin: 0; }
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          main { padding: 0 !important; }
          .no-print { display: none !important; }
          body * { visibility: hidden; }
          .hc-doc, .hc-doc * { visibility: visible !important; }
          .hc-doc {
            position: absolute;
            top: 0;
            left: 0;
            width: 8.5in;
            height: 11in;
            min-height: 0;
            margin: 0;
            overflow: hidden;
          }
          .hc-bg {
            position: absolute;
            inset: 0;
            width: 8.5in;
            height: 11in;
            object-fit: fill;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          /* Zona segura en pulgadas (libra mancha sup-izq e inf-der) */
          .hc-content { padding: 1.9in 0.6in 3.3in 1.7in !important; }
        }
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

      <div className="hc-doc ring-1 ring-zinc-200 print:ring-0">
        {/* Membrete oficial — <img> (no background-image) para que imprima */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="hc-bg" src="/membrete-historia.png" alt="" />

        <div className="hc-content">
          {/* Encabezado de la doctora (el membrete es solo decorativo) */}
          <div className="text-center">
            <p className="text-[12px] font-semibold text-zinc-800">
              Dra. Fedra Yarissa Aldama Castro
            </p>
            <p className="text-[9px] text-zinc-500">
              Médico Cirujano · Céd. Prof. 11015233 · S.S.A. 20982
            </p>
          </div>

          <h1 className="mt-3 text-center text-[15px] font-semibold tracking-wide text-zinc-900">
            HISTORIA CLÍNICA
          </h1>
          <p className="text-center text-[10px] text-zinc-500">
            {h.tipos_historia?.nombre ?? ""}
          </p>

          <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-0.5 text-[10px] text-zinc-700">
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

          <div className="mt-3 space-y-2.5">
            {secciones.map((s) => (
              <section key={s.nombre} className="break-inside-avoid">
                <h2 className="mb-1 border-b border-[#cbbfae] pb-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#9a8c7a]">
                  {s.nombre}
                </h2>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-0.5 text-[10px] sm:grid-cols-2">
                  {s.filas.map(([k, v], i) => (
                    <div
                      key={i}
                      className="flex justify-between gap-3 border-b border-zinc-100 py-0.5"
                    >
                      <dt className="text-zinc-500">{k}</dt>
                      <dd className="text-right font-medium text-zinc-800">{v}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
            {secciones.length === 0 && (
              <p className="text-sm text-zinc-400">Esta historia no tiene datos.</p>
            )}
          </div>

          {/* Firma al final */}
          <div className="mt-10 break-inside-avoid text-center">
            <div className="mx-auto w-52 border-t border-zinc-500" />
            <p className="mt-1 text-[10px] font-semibold text-zinc-800">
              Dra. Fedra Yarissa Aldama Castro
            </p>
            <p className="text-[9px] text-zinc-500">
              Médico Cirujano · Céd. Prof. 11015233 · S.S.A. 20982
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
