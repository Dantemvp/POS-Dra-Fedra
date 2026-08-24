"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth";

export type ActionResult = { ok: boolean; error?: string };

// Eliminar producto — SOLO admin. Si no tiene ventas ni movimientos (basura de
// prueba), lo borra de verdad. Si ya tiene historial, lo archiva (activo=false)
// para no romper la contabilidad.
export async function eliminarProducto(id: string): Promise<ActionResult> {
  const usuario = await getUsuarioActual();
  if (usuario?.rol !== "admin")
    return { ok: false, error: "Solo el administrador puede eliminar productos." };
  if (!id) return { ok: false, error: "Falta el producto." };

  const supabase = await createClient();

  // ¿Tiene historial que debamos preservar?
  const [{ count: ventas }, { count: movs }] = await Promise.all([
    supabase
      .from("venta_items")
      .select("id", { count: "exact", head: true })
      .eq("producto_id", id),
    supabase
      .from("movimientos_inv")
      .select("id", { count: "exact", head: true })
      .eq("producto_id", id),
  ]);

  if ((ventas ?? 0) > 0 || (movs ?? 0) > 0) {
    const { error } = await supabase
      .from("productos")
      .update({ activo: false })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/inventario");
    return {
      ok: true,
      error: "El producto tenía ventas/movimientos, así que se archivó (no se borra historial).",
    };
  }

  // Sin historial: borrar dependientes y el producto
  await supabase.from("producto_archivos").delete().eq("producto_id", id);
  await supabase.from("compra_items").delete().eq("producto_id", id);
  await supabase.from("lotes").delete().eq("producto_id", id);
  const { error } = await supabase.from("productos").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/inventario");
  return { ok: true };
}

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
    codigo_barras: String(formData.get("codigo_barras") ?? "").trim() || null,
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

// Registrar metadatos de un archivo ya subido al Storage
export async function registrarArchivo(
  productoId: string,
  path: string,
  nombre: string,
  tipo: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let uid: string | null = null;
  if (user) {
    const { data } = await supabase
      .from("usuarios")
      .select("id")
      .eq("auth_uid", user.id)
      .single();
    uid = data?.id ?? null;
  }
  const { error } = await supabase.from("producto_archivos").insert({
    producto_id: productoId,
    path,
    nombre,
    tipo,
    subido_por: uid,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/inventario/${productoId}`);
  return { ok: true };
}

export async function eliminarArchivo(
  id: string,
  path: string,
  productoId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  // Se comprueba el retiro antes de borrar la fila. Con la politica de FED-014
  // colgada de `producto_archivos`, si el objeto no se retira y la fila se
  // borra igual, el objeto queda huerfano y ya nadie puede alcanzarlo ni para
  // limpiarlo.
  const { error: errorRetiro } = await supabase.storage
    .from("archivos")
    .remove([path]);
  if (errorRetiro)
    return {
      ok: false,
      error: `No se pudo retirar el archivo: ${errorRetiro.message}. La ficha no se borro.`,
    };
  const { error } = await supabase.from("producto_archivos").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/inventario/${productoId}`);
  return { ok: true };
}

// Editar un producto existente
export async function actualizarProducto(
  productoId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!nombre) return { ok: false, error: "El nombre es obligatorio." };

  const { error } = await supabase
    .from("productos")
    .update({
      nombre,
      precio_venta: Number(formData.get("precio_venta") ?? 0) || 0,
      stock_minimo: Number(formData.get("stock_minimo") ?? 0) || 0,
      es_controlado: formData.get("es_controlado") === "on",
      requiere_receta: formData.get("requiere_receta") === "on",
      fraccion_cofepris: String(formData.get("fraccion_cofepris") ?? "na"),
      codigo_barras: String(formData.get("codigo_barras") ?? "").trim() || null,
    })
    .eq("id", productoId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/inventario/${productoId}`);
  revalidatePath("/inventario");
  return { ok: true };
}
