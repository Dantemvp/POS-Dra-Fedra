import { createClient } from "@/lib/supabase/server";
import NuevaCita from "./NuevaCita";
import CitaCard from "./CitaCard";
import CalendarioAgenda, { type CitaCal } from "./CalendarioAgenda";
import { confirmacionVencida, necesitaConfirmar } from "./confirmacion";

export type Cita = {
  id: string;
  fecha_hora: string;
  estado: "agendada" | "confirmada" | "cancelada" | "cedida" | "atendida";
  notas: string | null;
  recordatorio_enviado: boolean;
  limite_confirmacion: string | null;
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

  // Ventana del calendario: 6 meses atrás → 12 meses adelante.
  const winIni = `${hoyClave.slice(0, 8)}01T00:00:00-07:00`;
  const calDesde = new Date(winIni);
  calDesde.setMonth(calDesde.getMonth() - 6);
  const calHasta = new Date(winIni);
  calHasta.setMonth(calHasta.getMonth() + 12);

  const [{ data: citasData }, { data: pacData }, { data: calData }] =
    await Promise.all([
      supabase
        .from("citas")
        .select(
          "id, fecha_hora, estado, notas, recordatorio_enviado, limite_confirmacion, paciente:pacientes(id, nombre, apellidos, telefono_wpp)",
        )
        .gte("fecha_hora", desde)
        .neq("estado", "cancelada")
        .order("fecha_hora"),
      supabase
        .from("pacientes")
        .select("id, nombre, apellidos")
        .order("nombre"),
      supabase
        .from("citas")
        .select(
          "id, fecha_hora, estado, paciente:pacientes(id, nombre, apellidos)",
        )
        .gte("fecha_hora", calDesde.toISOString())
        .lte("fecha_hora", calHasta.toISOString())
        .order("fecha_hora"),
    ]);

  const citas = (citasData ?? []) as unknown as Cita[];
  const pacientes = (pacData ?? []) as PacienteOpcion[];

  type CalRow = {
    id: string;
    fecha_hora: string;
    estado: string;
    paciente: { id: string; nombre: string; apellidos: string | null } | null;
  };
  const citasCal: CitaCal[] = ((calData ?? []) as unknown as CalRow[]).map(
    (c) => ({
      id: c.id,
      fecha_hora: c.fecha_hora,
      estado: c.estado,
      paciente_id: c.paciente?.id ?? null,
      nombre: c.paciente
        ? `${c.paciente.nombre} ${c.paciente.apellidos ?? ""}`.trim()
        : "—",
    }),
  );

  // Estado de confirmación
  const ahora = new Date();
  const vencida = (c: Cita) =>
    confirmacionVencida(c.estado, c.fecha_hora, c.limite_confirmacion, ahora);
  const porConfirmar = citas.filter((c) => necesitaConfirmar(c.estado)).length;
  const vencidas = citas.filter(vencida).length;

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

      {porConfirmar > 0 && (
        <div
          className={`mb-6 flex items-center gap-3 rounded-xl px-4 py-3 text-sm ring-1 ${
            vencidas > 0
              ? "bg-red-50 text-red-800 ring-red-200"
              : "bg-amber-50 text-amber-800 ring-amber-200"
          }`}
        >
          <span className="text-lg leading-none">
            {vencidas > 0 ? "⚠️" : "🔔"}
          </span>
          <span>
            <strong>{porConfirmar}</strong> cita
            {porConfirmar === 1 ? "" : "s"} por confirmar
            {vencidas > 0 && (
              <>
                {" "}
                — <strong>{vencidas}</strong> ya pasó
                {vencidas === 1 ? "" : "ron"} su fecha límite. Manda el
                recordatorio por WhatsApp.
              </>
            )}
          </span>
        </div>
      )}

      <div className="mb-6">
        <CalendarioAgenda citas={citasCal} />
      </div>

      <NuevaCita pacientes={pacientes} />

      <h2 className="mb-3 mt-8 text-lg font-medium text-zinc-900">Próximas citas</h2>
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
                  <CitaCard key={c.id} cita={c} vencida={vencida(c)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
