import { createClient } from "@/lib/supabase/server";
import NuevaCita from "./NuevaCita";
import CitaCard from "./CitaCard";

export type Cita = {
  id: string;
  fecha_hora: string;
  estado: "agendada" | "confirmada" | "cancelada" | "cedida" | "atendida";
  notas: string | null;
  recordatorio_enviado: boolean;
  paciente: {
    id: string;
    nombre: string;
    apellidos: string | null;
    telefono_wpp: string | null;
  } | null;
};

export type PacienteOpcion = {
  id: string;
  nombre: string;
  apellidos: string | null;
};

const TZ = "America/Mazatlan"; // Sinaloa, UTC-7 todo el año

// Agrupa por día (clave YYYY-MM-DD en zona de Sinaloa).
function claveDia(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function tituloDia(iso: string) {
  const t = new Intl.DateTimeFormat("es-MX", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(iso));
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export default async function AgendaPage() {
  const supabase = await createClient();

  // Desde el inicio del día de hoy (en Sinaloa) en adelante.
  const hoyClave = claveDia(new Date().toISOString());
  const desde = `${hoyClave}T00:00:00-07:00`;

  const [{ data: citasData }, { data: pacData }] = await Promise.all([
    supabase
      .from("citas")
      .select(
        "id, fecha_hora, estado, notas, recordatorio_enviado, paciente:pacientes(id, nombre, apellidos, telefono_wpp)",
      )
      .gte("fecha_hora", desde)
      .neq("estado", "cancelada")
      .order("fecha_hora"),
    supabase
      .from("pacientes")
      .select("id, nombre, apellidos")
      .order("nombre"),
  ]);

  const citas = (citasData ?? []) as unknown as Cita[];
  const pacientes = (pacData ?? []) as PacienteOpcion[];

  // Agrupar por día
  const grupos = new Map<string, Cita[]>();
  for (const c of citas) {
    const k = claveDia(c.fecha_hora);
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k)!.push(c);
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-1 text-2xl font-semibold text-zinc-900">Agenda</h1>
      <p className="mb-6 text-sm text-zinc-500">
        {citas.length} cita{citas.length === 1 ? "" : "s"} próxima
        {citas.length === 1 ? "" : "s"}
      </p>

      <NuevaCita pacientes={pacientes} />

      {grupos.size === 0 ? (
        <div className="rounded-xl bg-white px-4 py-12 text-center text-sm text-zinc-400 ring-1 ring-zinc-200">
          No hay citas próximas.
        </div>
      ) : (
        <div className="space-y-6">
          {[...grupos.entries()].map(([dia, lista]) => (
            <section key={dia}>
              <h2 className="mb-2 text-sm font-semibold text-zinc-700">
                {tituloDia(lista[0].fecha_hora)}
              </h2>
              <div className="space-y-2">
                {lista.map((c) => (
                  <CitaCard key={c.id} cita={c} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
