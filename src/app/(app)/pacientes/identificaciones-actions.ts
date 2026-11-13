"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { BUCKET_IDENTIFICACIONES, MAX_IDENTIFICACION_BYTES, TIPOS_IDENTIFICACION, idPacienteValido, nombreIdentificacionValido, puedeGestionarIdentificacion, validarIdentificacion } from "@/lib/identificacion-paciente";

async function acceso(pacienteId: string) {
  if (!idPacienteValido(pacienteId)) throw new Error("No se encontró el paciente.");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Inicia sesión para consultar identificaciones.");
  const { data: perfil, error } = await supabase.from("usuarios").select("rol").eq("auth_uid", user.id).single();
  if (error || !puedeGestionarIdentificacion(perfil?.rol)) throw new Error("Tu usuario no tiene acceso a identificaciones de pacientes.");
  const { data: paciente, error: errorPaciente } = await supabase.from("pacientes").select("id").eq("id",pacienteId).single();
  if (errorPaciente || !paciente) throw new Error("No se encontró el paciente.");
  return supabase;
}

export async function listarIdentificaciones(pacienteId: string) {
  try {
    const supabase = await acceso(pacienteId);
    const { data, error } = await supabase.storage.from(BUCKET_IDENTIFICACIONES).list(`pacientes/${pacienteId}`, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
    if (error) return { ok: false as const, error: "No se pudo consultar el espacio privado de identificaciones. Pide al administrador revisar su configuración." };
    return { ok: true as const, archivos: (data ?? []).filter(d => nombreIdentificacionValido(d.name)).map(d => ({ nombre: d.name, fecha: d.created_at })) };
  } catch (e) { return { ok: false as const, error: e instanceof Error ? e.message : "No se pudieron consultar las identificaciones." }; }
}

export async function subirIdentificacion(form: FormData) {
  try {
    const pacienteId = String(form.get("paciente_id") ?? "");
    const supabase = await acceso(pacienteId);
    const tipo = String(form.get("tipo") ?? "");
    if (!Object.hasOwn(TIPOS_IDENTIFICACION, tipo)) throw new Error("Selecciona el tipo de identificación.");
    const file = form.get("archivo");
    if (!(file instanceof File) || !file.size || file.size > MAX_IDENTIFICACION_BYTES) throw new Error("Elige una identificación de hasta 4 MB.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const formato = validarIdentificacion(file.name, file.type, bytes);
    const nombre = `${tipo}-${crypto.randomUUID()}.${formato.extension}`;
    const { error } = await supabase.storage.from(BUCKET_IDENTIFICACIONES).upload(`pacientes/${pacienteId}/${nombre}`, bytes, { contentType: formato.mime, upsert: false });
    if (error) return { ok: false as const, error: "No se pudo guardar la identificación. Conserva el archivo e intenta de nuevo; si continúa, pide revisar el espacio privado." };
    revalidatePath(`/pacientes/${pacienteId}`);
    return { ok: true as const, nombre };
  } catch (e) { return { ok: false as const, error: e instanceof Error ? e.message : "No se pudo cargar la identificación." }; }
}

export async function abrirIdentificacion(pacienteId: string, nombre: string) {
  try {
    if (!nombreIdentificacionValido(nombre)) throw new Error("Archivo no válido.");
    const supabase = await acceso(pacienteId);
    const { data, error } = await supabase.storage.from(BUCKET_IDENTIFICACIONES).createSignedUrl(`pacientes/${pacienteId}/${nombre}`, 60, { download: `identificacion.${nombre.split('.').at(-1)}` });
    if (error || !data?.signedUrl) throw new Error("No se pudo abrir la identificación. Intenta de nuevo.");
    return { ok: true as const, url: data.signedUrl };
  } catch (e) { return { ok: false as const, error: e instanceof Error ? e.message : "No se pudo abrir la identificación." }; }
}
