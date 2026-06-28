"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ItemVenta = {
  producto_id: string;
  cantidad: number;
  precio_unit: number;
};

export type CobrarResult = {
  ok: boolean;
  error?: string;
  folio?: number;
  ventaId?: string;
};

export type PagoVenta = { metodo: string; monto: number };

export async function cobrar(
  items: ItemVenta[],
  metodo: string,
  pacienteId?: string | null,
  pagos?: PagoVenta[] | null,
): Promise<CobrarResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("registrar_venta", {
    p_items: items.map((i) => ({
      producto_id: i.producto_id,
      cantidad: i.cantidad,
      precio_unit: i.precio_unit,
    })),
    p_metodo: metodo,
    p_paciente: pacienteId ?? null,
    // Solo se manda con pago dividido; si no, la RPC usa p_metodo (igual que antes).
    p_pagos: pagos && pagos.length > 0 ? pagos : null,
  });

  if (error) return { ok: false, error: error.message };

  const row = Array.isArray(data) ? data[0] : data;
  revalidatePath("/ventas");
  revalidatePath("/inventario");
  return { ok: true, folio: row?.folio, ventaId: row?.venta_id };
}

export type RecetaCargada = {
  ok: boolean;
  error?: string;
  productoIds?: string[];
  sinLigar?: string[]; // medicamentos de texto libre, no ligados a inventario
};

// Carga los productos de una receta por folio (para escanear "REC<folio>" en el
// POS). Usa una RPC security definer que NO expone datos clínicos.
export async function cargarReceta(folio: number): Promise<RecetaCargada> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("productos_de_receta", {
    p_folio: folio,
  });
  if (error) return { ok: false, error: error.message };

  const filas = (data ?? []) as { producto_id: string | null; medicamento: string | null }[];
  if (filas.length === 0)
    return { ok: false, error: `No se encontró la receta REC${folio}.` };

  const productoIds = filas
    .filter((f) => f.producto_id)
    .map((f) => f.producto_id as string);
  const sinLigar = filas
    .filter((f) => !f.producto_id)
    .map((f) => f.medicamento ?? "—");
  return { ok: true, productoIds, sinLigar };
}
