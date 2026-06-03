"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { OFFSET_SINALOA, limiteConfirmacion } from "./confirmacion";

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

  const pacienteId = String(formData.get("paciente_id") ?? "");
  const fecha = String(formData.get("fecha") ?? "");
  const hora = String(formData.get("hora") ?? "");
  if (!pacienteId) return { ok: false, error: "Selecciona un paciente." };
  if (!fecha || !hora) return { ok: false, error: "Falta fecha u hora." };

  // Instante exacto en zona de Sinaloa (evita que la cita se corra al guardar).
  const fechaHora = `${fecha}T${hora}:00${OFFSET_SINALOA}`;

  const { data, error } = await supabase
    .from("citas")
    .insert({
      paciente_id: pacienteId,
      doctora_id: uid,
      fecha_hora: fechaHora,
      limite_confirmacion: limiteConfirmacion(fechaHora),
      notas: String(formData.get("notas") ?? "").trim() || null,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
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
