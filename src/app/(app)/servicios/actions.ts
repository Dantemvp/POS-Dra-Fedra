"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type Result = { ok: boolean; error?: string };

export async function crearServicio(
  _prev: Result,
  formData: FormData,
): Promise<Result> {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const categoria = String(formData.get("categoria") ?? "").trim() || null;
  const precio = Number(formData.get("precio") ?? 0) || 0;
  if (!nombre) return { ok: false, error: "Escribe el nombre del servicio." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("servicios")
    .insert({ nombre, categoria, precio });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/servicios");
  return { ok: true };
}

export async function actualizarServicio(
  id: string,
  campos: { precio?: number; nombre?: string; categoria?: string | null; activo?: boolean },
): Promise<Result> {
  if (!id) return { ok: false, error: "Falta identificar el servicio." };
  const actualizacion: {
    precio?: number;
    nombre?: string;
    categoria?: string | null;
    activo?: boolean;
  } = {};
  if (campos.precio !== undefined) {
    if (!Number.isFinite(campos.precio) || campos.precio < 0)
      return { ok: false, error: "El precio no es válido." };
    actualizacion.precio = campos.precio;
  }
  if (campos.nombre !== undefined) {
    const nombre = campos.nombre.trim();
    if (!nombre) return { ok: false, error: "Escribe el nombre del servicio." };
    actualizacion.nombre = nombre;
  }
  if (campos.categoria !== undefined)
    actualizacion.categoria = campos.categoria?.trim() || null;
  if (campos.activo !== undefined) actualizacion.activo = Boolean(campos.activo);
  if (Object.keys(actualizacion).length === 0)
    return { ok: false, error: "No hay cambios para guardar." };

  const supabase = await createClient();
  const { error } = await supabase.from("servicios").update(actualizacion).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/servicios");
  return { ok: true };
}
