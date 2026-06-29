"use server";

import { revalidatePath } from "next/cache";
import { getUsuarioActual } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export type Result = { ok: boolean; error?: string };

// Desconecta el calendario: revoca el permiso en Google (best-effort) y borra
// la conexión guardada. Las citas existentes conservan su google_event_id pero
// dejan de sincronizarse. Solo admin/doctora.
export async function desconectarGoogle(): Promise<Result> {
  const u = await getUsuarioActual();
  if (!u || (u.rol !== "admin" && u.rol !== "doctora"))
    return { ok: false, error: "No tienes permiso." };

  const admin = createAdminClient();
  const { data } = await admin
    .from("google_calendar_conexion")
    .select("refresh_token")
    .eq("id", true)
    .maybeSingle();

  if (data?.refresh_token) {
    try {
      await fetch(
        `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(
          data.refresh_token,
        )}`,
        { method: "POST" },
      );
    } catch {
      /* aunque falle la revocación, borramos la conexión local */
    }
  }

  const { error } = await admin
    .from("google_calendar_conexion")
    .delete()
    .eq("id", true);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/agenda");
  return { ok: true };
}
