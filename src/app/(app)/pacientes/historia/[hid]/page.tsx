import Link from "next/link";
import Image from "next/image";
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

  return (
    <div className="mx-auto max-w-3xl">
      <style>{`@media print { @page { size: letter; margin: 14mm; } }`}</style>

      <div className="mb-4 flex items-center justify-between no-print">
        <Link
          href={p ? "/pacientes" : "#"}
          className="text-sm text-zinc-500 hover:text-zinc-900"
        >
          ← Pacientes
        </Link>
        <PrintButton />
      </div>

      <div className="print-area mx-auto bg-white p-10 ring-1 ring-zinc-200">
        {/* Encabezado branded */}
        <div className="flex items-start justify-between border-b-2 border-[#b8aa9c] pb-4">
          <Image src="/logo.png" alt="Dra. Fedra Aldama" width={240} height={38} priority />
          <div className="text-right text-[10px] leading-snug text-zinc-600">
            <p className="font-semibold text-zinc-800">
              Dra. Fedra Yarissa Aldama Castro
            </p>
            <p>Médico Cirujano — U. Autónoma de Guadalajara</p>
            <p>Céd. Prof. 11015233 · S.S.A. 20982</p>
          </div>
        </div>

        {/* Título + paciente */}
        <div className="mt-5">
          <h1 className="text-lg font-semibold text-zinc-900">
            Historia clínica — {h.tipos_historia?.nombre ?? ""}
          </h1>
          <div className="mt-1 flex flex-wrap gap-x-6 gap-y-0.5 text-sm text-zinc-600">
            <span>
              <span className="text-zinc-400">Paciente: </span>
              {p ? `${p.nombre} ${p.apellidos ?? ""}` : "—"}
            </span>
            {p?.sexo && <span>Sexo: {p.sexo}</span>}
            {p?.fecha_nac && <span>Nac.: {p.fecha_nac}</span>}
            <span>
              <span className="text-zinc-400">Fecha: </span>
              {new Date(h.fecha).toLocaleDateString("es-MX")}
            </span>
          </div>
        </div>

        {/* Secciones */}
        <div className="mt-5 space-y-5">
          {secciones.map((s) => (
            <section key={s.nombre}>
              <h2 className="mb-2 border-b border-zinc-200 pb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {s.nombre}
              </h2>
              <dl className="grid grid-cols-1 gap-x-8 gap-y-1.5 text-sm sm:grid-cols-2">
                {s.filas.map(([k, v], i) => (
                  <div key={i} className="flex justify-between gap-3 border-b border-zinc-50 py-0.5">
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

        {/* Pie: firma + contacto */}
        <div className="mt-12 flex items-end justify-between">
          <div className="text-[10px] leading-snug text-zinc-500">
            <p>Tel. 668 146 35 02</p>
            <p>Blvd Río Fuerte 2677, Viñedos</p>
            <p>Los Mochis, Sin.</p>
          </div>
          <div className="text-center">
            <div className="mx-auto w-56 border-t border-zinc-400" />
            <p className="mt-1 text-xs text-zinc-600">Dra. Fedra Aldama</p>
          </div>
        </div>
      </div>
    </div>
  );
}
