"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { OFFSET_SINALOA, limiteConfirmacion } from "./confirmacion";
import { TIPOS_CITA_VALORES as TIPOS } from "./tipos";
import { crearEvento, borrarEvento } from "@/lib/google/calendar";

export type Result = { ok: boolean; error?: string; id?: string };

async function usuarioId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("usuarios")
    .select("id")
    .eq("auth_uid", user.id)
    .single();
  return data?.id ?? null;
}

export async function crearCita(
  _prev: Result,
  formData: FormData,
): Promise<Result> {
  const supabase = await createClient();
  const uid = await usuarioId(supabase);

  const tipo = String(formData.get("tipo") ?? "cita_paciente");
  const pacienteId = String(formData.get("paciente_id") ?? "");
  const titulo = String(formData.get("titulo") ?? "").trim();
  const fecha = String(formData.get("fecha") ?? "");
  const hora = String(formData.get("hora") ?? "");
  if (!TIPOS.includes(tipo)) return { ok: false, error: "Tipo no válido." };
  if (!fecha || !hora) return { ok: false, error: "Falta fecha u hora." };

  const esPaciente = tipo === "cita_paciente";
  if (esPaciente && !pacienteId)
    return { ok: false, error: "Selecciona un paciente." };
  if (!esPaciente && !titulo)
    return { ok: false, error: "Ponle un título al evento." };

  // Instante exacto en zona de Sinaloa (evita que se corra al guardar).
  const fechaHora = `${fecha}T${hora}:00${OFFSET_SINALOA}`;

  const { data, error } = await supabase
    .from("citas")
    .insert({
      tipo,
      paciente_id: esPaciente ? pacienteId : null,
      titulo: esPaciente ? null : titulo,
      doctora_id: uid,
      fecha_hora: fechaHora,
      // Solo las citas de paciente requieren confirmación/recordatorio.
      limite_confirmacion: esPaciente ? limiteConfirmacion(fechaHora) : null,
      notas: String(formData.get("notas") ?? "").trim() || null,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  // Sincronizar a Google Calendar (POS -> Calendar). Best-effort: si no hay
  // conexión o Google falla, la cita ya quedó guardada; no rompemos nada.
  try {
    let titEvento = titulo;
    if (esPaciente) {
      const { data: p } = await supabase
        .from("pacientes")
        .select("nombre")
        .eq("id", pacienteId)
        .single();
      titEvento = `Cita: ${p?.nombre ?? "Paciente"}`;
    }
    const eventId = await crearEvento({
      titulo: titEvento || "Evento",
      inicioISO: fechaHora,
      descripcion: String(formData.get("notas") ?? "").trim() || null,
    });
    if (eventId)
      await supabase
        .from("citas")
        .update({ google_event_id: eventId })
        .eq("id", data.id);
  } catch (e) {
    console.error("[gcal] sync crearCita", e);
  }

  revalidatePath("/agenda");
  return { ok: true, id: data.id };
}

export async function cambiarEstadoCita(
  id: string,
  estado: "agendada" | "confirmada" | "cancelada" | "cedida" | "atendida",
): Promise<Result> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = { estado };
  if (estado === "confirmada") patch.confirmada_en = new Date().toISOString();
  const { error } = await supabase.from("citas").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };

  // Si se cancela, quitar el evento de Google Calendar (best-effort).
  if (estado === "cancelada") {
    try {
      const { data: c } = await supabase
        .from("citas")
        .select("google_event_id")
        .eq("id", id)
        .single();
      if (c?.google_event_id) {
        await borrarEvento(c.google_event_id);
        await supabase
          .from("citas")
          .update({ google_event_id: null })
          .eq("id", id);
      }
    } catch (e) {
      console.error("[gcal] sync cancelar", e);
    }
  }

  revalidatePath("/agenda");
  return { ok: true };
}

// Marca que ya se mandó el recordatorio por WhatsApp (al abrir el wa.me).
export async function marcarRecordatorio(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("citas")
    .update({ recordatorio_enviado: true })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/agenda");
  return { ok: true };
}
