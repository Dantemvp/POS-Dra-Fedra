import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth";
import { etiquetaDiaCorta } from "@/lib/tz";
import NuevaHistoria, { type Tipo } from "./NuevaHistoria";
import ImportarInBody from "./ImportarInBody";
import HistoriaCard from "./HistoriaCard";
import ProgresoPeso, { type PuntoProgreso } from "./ProgresoPeso";

// Edad en años a partir de la fecha de nacimiento.
function edadDe(fnac: string | null): string | null {
  if (!fnac) return null;
  const d = new Date(fnac);
  if (isNaN(d.getTime())) return null;
  const años = Math.floor((Date.now() - d.getTime()) / 31_557_600_000);
  return años >= 0 && años < 130 ? `${años} años` : null;
}

// Limpia el teléfono a formato wa.me (México = 52).
function waLink(tel: string | null): string | null {
  if (!tel) return null;
  let d = tel.replace(/\D/g, "");
  if (!d) return null;
  if (d.length === 10) d = "52" + d;
  return `https://wa.me/${d}`;
}

// Saca un número de un valor JSON (soporta "72.5", "72,5", "72 kg").
function aNumero(v: unknown): number | null {
  if (v == null) return null;
  const m = String(v).replace(",", ".").match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return isNaN(n) ? null : n;
}

// Busca en las respuestas la primera clave que cumple el predicado.
function elegir(
  datos: Record<string, unknown>,
  pred: (clave: string) => boolean,
): number | null {
  for (const [k, v] of Object.entries(datos)) {
    if (pred(k.toLowerCase())) {
      const n = aNumero(v);
      if (n != null) return n;
    }
  }
  return null;
}

type Paciente = {
  id: string;
  nombre: string;
  apellidos: string | null;
  fecha_nac: string | null;
  sexo: string | null;
  telefono_wpp: string | null;
  email: string | null;
};

type Historia = {
  id: string;
  fecha: string;
  datos: Record<string, unknown>;
  tipos_historia: { nombre: string } | null;
};

export default async function PacienteDetalle({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const usuario = await getUsuarioActual();
  const esAdmin = usuario?.rol === "admin";

  const { data: paciente } = await supabase
    .from("pacientes")
    .select("id, nombre, apellidos, fecha_nac, sexo, telefono_wpp, email")
    .eq("id", id)
    .single();

  if (!paciente) notFound();
  const p = paciente as Paciente;

  const { data: tiposData } = await supabase
    .from("tipos_historia")
    .select(
      "id, nombre, campos_historia(id, etiqueta, tipo_dato, opciones, orden, requerido, seccion)",
    )
    .eq("activo", true)
    .order("nombre");

  const tipos = ((tiposData ?? []) as Tipo[]).map((t) => ({
    ...t,
    campos_historia: [...(t.campos_historia ?? [])].sort(
      (a, b) => a.orden - b.orden,
    ),
  }));

  // Mapa campoId -> etiqueta (para mostrar las respuestas guardadas)
  const etiquetas = new Map<string, string>();
  // Mapa campoId -> definición (tipo + opciones) para editar con el control correcto
  const defs: Record<string, { tipo_dato: string; opciones: string[] | null }> = {};
  for (const t of tipos)
    for (const c of t.campos_historia) {
      etiquetas.set(c.id, c.etiqueta);
      defs[c.id] = { tipo_dato: c.tipo_dato, opciones: c.opciones ?? null };
    }

  const { data: histData } = await supabase
    .from("historias_clinicas")
    .select("id, fecha, datos, tipos_historia(nombre)")
    .eq("paciente_id", id)
    .order("fecha", { ascending: false });

  const historias = (histData ?? []) as unknown as Historia[];

  // Fase actual del tratamiento (de la última receta).
  const { data: ultRecetaArr } = await supabase
    .from("recetas")
    .select("fase, fecha")
    .eq("paciente_id", id)
    .not("fase", "is", null)
    .order("fecha", { ascending: false })
    .limit(1);
  const faseActual = (ultRecetaArr?.[0]?.fase as number | null) ?? null;

  // Progreso de peso: extrae métricas de las historias (InBody/control de peso),
  // de la más antigua a la más reciente, para graficar la evolución.
  const puntos: PuntoProgreso[] = [...historias]
    .reverse()
    .map((h) => {
      const d = h.datos ?? {};
      return {
        fecha: etiquetaDiaCorta(h.fecha),
        peso: elegir(
          d,
          (k) =>
            k.includes("peso") &&
            !k.includes("ideal") &&
            !k.includes("sugerido") &&
            !k.includes("perdido"),
        ),
        imc: elegir(d, (k) => k.includes("imc")),
        grasa: elegir(
          d,
          (k) => k.includes("grasa corporal") || (k.includes("grasa") && k.includes("%")),
        ),
        cintura: elegir(
          d,
          (k) => k.includes("cintura") && !k.includes("cadera") && !k.includes("relaci"),
        ),
      };
    })
    .filter((p) => p.peso != null || p.imc != null || p.grasa != null || p.cintura != null);

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/pacientes"
        className="text-sm text-zinc-500 hover:text-zinc-900"
      >
        ← Pacientes
      </Link>

      <div className="mt-2 mb-6 rounded-xl bg-white p-5 ring-1 ring-zinc-200">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-zinc-900">
              {p.nombre} {p.apellidos ?? ""}
            </h1>
            {faseActual != null && (
              <span className="rounded-full bg-[#efe7db] px-3 py-1 text-xs font-semibold text-[#8c7a63]">
                Fase {faseActual}
              </span>
            )}
          </div>
          {waLink(p.telefono_wpp) && (
            <a
              href={waLink(p.telefono_wpp)!}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
            >
              WhatsApp
            </a>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-zinc-600">
          {p.telefono_wpp && <span>WhatsApp: {p.telefono_wpp}</span>}
          {p.email && <span>{p.email}</span>}
          {p.sexo && <span>Sexo: {p.sexo}</span>}
          {edadDe(p.fecha_nac) && <span>{edadDe(p.fecha_nac)}</span>}
        </div>
      </div>

      {puntos.length > 0 && <ProgresoPeso puntos={puntos} />}

      <ImportarInBody
        pacienteId={p.id}
        inbodyTipoId={tipos.find((t) => t.nombre === "InBody")?.id ?? null}
      />

      <NuevaHistoria pacienteId={p.id} tipos={tipos} />

      <h2 className="mb-3 text-lg font-medium text-zinc-900">
        Historias clínicas
      </h2>
      <div className="space-y-3">
        {historias.length === 0 && (
          <p className="rounded-xl bg-white p-6 text-center text-sm text-zinc-400 ring-1 ring-zinc-200">
            Sin historias clínicas aún.
          </p>
        )}
        {historias.map((h) => (
          <HistoriaCard
            key={h.id}
            historiaId={h.id}
            pacienteId={p.id}
            titulo={h.tipos_historia?.nombre ?? "Historia"}
            fecha={new Date(h.fecha).toLocaleString("es-MX")}
            datos={h.datos ?? {}}
            labels={Object.fromEntries(etiquetas)}
            defs={defs}
            esAdmin={esAdmin}
          />
        ))}
      </div>
    </div>
  );
}
