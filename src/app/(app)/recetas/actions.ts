"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ItemReceta = {
  medicamento: string;
  dosis: string;
  duracion_dias: number | null;
  indicaciones: string;
  // Si el medicamento coincide con un producto del inventario, se liga su id
  // para que la farmacia lo cargue al escanear el folio de la receta.
  producto_id?: string | null;
};

export type Result = { ok: boolean; error?: string; id?: string };

// Devuelve los datos del último InBody guardado del paciente (para pre-cargar receta).
export async function ultimoInBody(
  pacienteId: string,
): Promise<{ ok: boolean; datos?: Record<string, unknown>; fecha?: string; error?: string }> {
  const supabase = await createClient();
  const { data: tipo } = await supabase
    .from("tipos_historia")
    .select("id")
    .eq("nombre", "InBody")
    .maybeSingle();
  if (!tipo) return { ok: false, error: "No existe el tipo InBody." };

  const { data } = await supabase
    .from("historias_clinicas")
    .select("datos, fecha")
    .eq("paciente_id", pacienteId)
    .eq("tipo_historia_id", tipo.id)
    .order("fecha", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data)
    return { ok: false, error: "Este paciente no tiene un InBody guardado." };
  return {
    ok: true,
    datos: data.datos as Record<string, unknown>,
    fecha: data.fecha as string,
  };
}

export async function crearReceta(
  pacienteId: string,
  fase: number | null,
  items: ItemReceta[],
  metricas: Record<string, string> = {},
): Promise<Result> {
  const supabase = await createClient();

  const limpios = items.filter((i) => i.medicamento.trim() !== "");
  if (!pacienteId) return { ok: false, error: "Selecciona un paciente." };
  if (limpios.length === 0)
    return { ok: false, error: "Agrega al menos un medicamento." };

  const metricasLimpias = Object.fromEntries(
    Object.entries(metricas).filter(([, v]) => v !== "" && v != null),
  );

  const { data: receta, error } = await supabase
    .from("recetas")
    .insert({
      paciente_id: pacienteId,
      fase,
      estado: "emitida",
      metricas: Object.keys(metricasLimpias).length ? metricasLimpias : null,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  const { error: itemsErr } = await supabase.from("receta_items").insert(
    limpios.map((i) => ({
      receta_id: receta.id,
      producto_id: i.producto_id ?? null,
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
