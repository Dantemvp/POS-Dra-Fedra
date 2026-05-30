"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

export async function crearPaciente(
  _prev: Result,
  formData: FormData,
): Promise<Result> {
  const supabase = await createClient();
  const uid = await usuarioId(supabase);

  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!nombre) return { ok: false, error: "El nombre es obligatorio." };

  const { data, error } = await supabase
    .from("pacientes")
    .insert({
      nombre,
      apellidos: String(formData.get("apellidos") ?? "").trim() || null,
      fecha_nac: String(formData.get("fecha_nac") ?? "") || null,
      sexo: String(formData.get("sexo") ?? "") || null,
      telefono_wpp: String(formData.get("telefono_wpp") ?? "").trim() || null,
      email: String(formData.get("email") ?? "").trim() || null,
      creado_por: uid,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/pacientes");
  return { ok: true, id: data.id };
}

export async function crearHistoria(
  pacienteId: string,
  tipoHistoriaId: string,
  datos: Record<string, unknown>,
): Promise<Result> {
  const supabase = await createClient();
  const uid = await usuarioId(supabase);

  const { error } = await supabase.from("historias_clinicas").insert({
    paciente_id: pacienteId,
    tipo_historia_id: tipoHistoriaId,
    datos,
    doctora_id: uid,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/pacientes/${pacienteId}`);
  return { ok: true };
}
