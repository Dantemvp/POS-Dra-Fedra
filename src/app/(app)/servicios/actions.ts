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
  const supabase = await createClient();
  const { error } = await supabase.from("servicios").update(campos).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/servicios");
  return { ok: true };
}
