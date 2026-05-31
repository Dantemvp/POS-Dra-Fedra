"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ItemReceta = {
  medicamento: string;
  dosis: string;
  duracion_dias: number | null;
  indicaciones: string;
};

export type Result = { ok: boolean; error?: string; id?: string };

export async function crearReceta(
  pacienteId: string,
  fase: number | null,
  items: ItemReceta[],
): Promise<Result> {
  const supabase = await createClient();

  const limpios = items.filter((i) => i.medicamento.trim() !== "");
  if (!pacienteId) return { ok: false, error: "Selecciona un paciente." };
  if (limpios.length === 0)
    return { ok: false, error: "Agrega al menos un medicamento." };

  const { data: receta, error } = await supabase
    .from("recetas")
    .insert({ paciente_id: pacienteId, fase, estado: "emitida" })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  const { error: itemsErr } = await supabase.from("receta_items").insert(
    limpios.map((i) => ({
      receta_id: receta.id,
      medicamento: i.medicamento.trim(),
      dosis: i.dosis.trim() || null,
      duracion_dias: i.duracion_dias,
      indicaciones: i.indicaciones.trim() || null,
    })),
  );

  if (itemsErr) return { ok: false, error: itemsErr.message };

  revalidatePath("/recetas");
  return { ok: true, id: receta.id };
}
