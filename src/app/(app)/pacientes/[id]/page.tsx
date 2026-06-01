import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NuevaHistoria, { type Tipo } from "./NuevaHistoria";
import ImportarInBody from "./ImportarInBody";
import HistoriaCard from "./HistoriaCard";

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
      "id, nombre, campos_historia(id, etiqueta, tipo_dato, opciones, orden, requerido)",
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
  for (const t of tipos)
    for (const c of t.campos_historia) etiquetas.set(c.id, c.etiqueta);

  const { data: histData } = await supabase
    .from("historias_clinicas")
    .select("id, fecha, datos, tipos_historia(nombre)")
    .eq("paciente_id", id)
    .order("fecha", { ascending: false });

  const historias = (histData ?? []) as unknown as Historia[];

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/pacientes"
        className="text-sm text-zinc-500 hover:text-zinc-900"
      >
        ← Pacientes
      </Link>

      <div className="mt-2 mb-6 rounded-xl bg-white p-5 ring-1 ring-zinc-200">
        <h1 className="text-2xl font-semibold text-zinc-900">
          {p.nombre} {p.apellidos ?? ""}
        </h1>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-zinc-600">
          {p.telefono_wpp && <span>WhatsApp: {p.telefono_wpp}</span>}
          {p.email && <span>{p.email}</span>}
          {p.sexo && <span>Sexo: {p.sexo}</span>}
          {p.fecha_nac && <span>Nac.: {p.fecha_nac}</span>}
        </div>
      </div>

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
          />
        ))}
      </div>
    </div>
  );
}
