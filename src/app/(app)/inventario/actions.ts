"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: boolean; error?: string };

// Alta de producto
export async function crearProducto(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();

  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!nombre) return { ok: false, error: "El nombre es obligatorio." };

  const precio = Number(formData.get("precio_venta") ?? 0);
  const stockMin = Number(formData.get("stock_minimo") ?? 0);
  const esControlado = formData.get("es_controlado") === "on";
  const fraccion = String(formData.get("fraccion_cofepris") ?? "na");
  const requiereReceta = formData.get("requiere_receta") === "on";

  const { error } = await supabase.from("productos").insert({
    nombre,
    precio_venta: isNaN(precio) ? 0 : precio,
    stock_minimo: isNaN(stockMin) ? 0 : stockMin,
    es_controlado: esControlado,
    fraccion_cofepris: fraccion,
    requiere_receta: requiereReceta,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/inventario");
  return { ok: true };
}

// Registrar entrada de inventario (crea lote + movimiento)
export async function registrarEntrada(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();

  const productoId = String(formData.get("producto_id") ?? "");
  const cantidad = Number(formData.get("cantidad") ?? 0);
  const lote = String(formData.get("lote") ?? "").trim() || null;
  const caducidad = String(formData.get("caducidad") ?? "") || null;
  const costo = formData.get("costo") ? Number(formData.get("costo")) : null;

  if (!productoId) return { ok: false, error: "Falta el producto." };
  if (!cantidad || cantidad <= 0)
    return { ok: false, error: "La cantidad debe ser mayor a 0." };

  // 1) Crear lote
  const { data: loteRow, error: loteErr } = await supabase
    .from("lotes")
    .insert({
      producto_id: productoId,
      lote,
      caducidad,
      cantidad_actual: cantidad,
      costo,
    })
    .select("id")
    .single();

  if (loteErr) return { ok: false, error: loteErr.message };

  // 2) Registrar movimiento (append-only, base del Libro de Control)
  const { error: movErr } = await supabase.from("movimientos_inv").insert({
    producto_id: productoId,
    lote_id: loteRow.id,
    tipo: "entrada",
    cantidad,
    motivo: "Entrada de inventario",
  });

  if (movErr) return { ok: false, error: movErr.message };

  revalidatePath("/inventario");
  return { ok: true };
}
