"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth";

export type Result = { ok: boolean; error?: string; id?: string };

// Cancelar (marcar cancelado, reversible) — admin, doctora o gerente.
// Queda registrado en Movimientos por el trigger de auditoría.
export async function cancelarCobro(id: string): Promise<Result> {
  const u = await getUsuarioActual();
  if (u?.rol !== "admin" && u?.rol !== "doctora" && u?.rol !== "gerente")
    return { ok: false, error: "No tienes permiso para cancelar cobros." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancelar_cobro", { p_cobro: id });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/cobros");
  revalidatePath("/inventario");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function eliminarCobro(id: string): Promise<Result> {
  const u = await getUsuarioActual();
  if (u?.rol !== "admin" && u?.rol !== "doctora")
    return {
      ok: false,
      error: "Solo la doctora o el administrador pueden eliminar cobros.",
    };
  const supabase = await createClient();
  const { error } = await supabase.rpc("eliminar_cobro", { p_cobro: id });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/cobros");
  revalidatePath("/inventario");
  revalidatePath("/dashboard");
  return { ok: true };
}

export type ItemCobro = {
  tipo: "servicio" | "producto";
  servicio_id: string | null;
  producto_id: string | null;
  descripcion: string;
  cantidad: number;
  precio_unit: number;
};

export type CobroInput = {
  paciente_id: string;
  items: ItemCobro[];
  metodo: "efectivo" | "tarjeta" | "transferencia" | "otro";
  nota?: string;
};

export async function crearCobro(input: CobroInput): Promise<Result> {
  if (!input.paciente_id) return { ok: false, error: "Selecciona un paciente." };
  const items = (input.items ?? []).filter(
    (i) => (i.descripcion || i.servicio_id || i.producto_id) && i.precio_unit >= 0,
  );
  if (items.length === 0)
    return { ok: false, error: "Agrega al menos un concepto." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("registrar_cobro", {
    p_paciente: input.paciente_id,
    p_metodo: input.metodo,
    p_nota: input.nota ?? "",
    p_items: items.map((i) => ({
      tipo: i.tipo,
      servicio_id: i.servicio_id,
      producto_id: i.producto_id,
      descripcion: i.descripcion,
      cantidad: i.cantidad || 1,
      precio_unit: i.precio_unit || 0,
    })),
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/cobros");
  revalidatePath("/inventario");
  revalidatePath("/dashboard");
  return { ok: true, id: data as string };
}
