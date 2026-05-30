"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CorteResult = { ok: boolean; error?: string };

export async function registrarCorte(
  totalVentas: number,
  totalEfectivo: number,
): Promise<CorteResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sin sesión." };

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("id")
    .eq("auth_uid", user.id)
    .single();
  if (!usuario) return { ok: false, error: "Usuario no encontrado." };

  const { error } = await supabase.from("cortes_caja").insert({
    usuario_id: usuario.id,
    cierre: new Date().toISOString(),
    total_ventas: totalVentas,
    total_efectivo: totalEfectivo,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/caja");
  return { ok: true };
}
