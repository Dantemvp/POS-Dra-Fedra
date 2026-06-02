"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ItemCompra = {
  producto_id: string;
  cantidad: string;
  costo: string;
  lote: string;
  caducidad: string;
};

export type Result = { ok: boolean; error?: string };

export async function registrarCompra(
  proveedor: string,
  factura: string,
  fecha: string,
  items: ItemCompra[],
): Promise<Result> {
  const supabase = await createClient();

  const limpios = items.filter(
    (i) => i.producto_id && Number(i.cantidad) > 0,
  );
  if (limpios.length === 0)
    return { ok: false, error: "Agrega al menos un producto con cantidad." };

  const { error } = await supabase.rpc("registrar_compra", {
    p_proveedor: proveedor || "",
    p_factura: factura || "",
    p_fecha: fecha || null,
    p_items: limpios.map((i) => ({
      producto_id: i.producto_id,
      cantidad: i.cantidad,
      costo: i.costo,
      lote: i.lote,
      caducidad: i.caducidad,
    })),
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/compras");
  revalidatePath("/inventario");
  return { ok: true };
}
