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

export async function cobrar(
  items: ItemVenta[],
  metodo: string,
  pacienteId?: string | null,
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
  });

  if (error) return { ok: false, error: error.message };

  const row = Array.isArray(data) ? data[0] : data;
  revalidatePath("/ventas");
  revalidatePath("/inventario");
  return { ok: true, folio: row?.folio, ventaId: row?.venta_id };
}
