"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { inicioDiaSinaloa } from "@/lib/tz";

export type CorteResult = { ok: boolean; error?: string };

// Cancela/devuelve una venta (regresa inventario). Atómico vía RPC.
export async function cancelarVenta(
  ventaId: string,
): Promise<CorteResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancelar_venta", {
    p_venta: ventaId,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/caja");
  revalidatePath("/inventario");
  revalidatePath("/dashboard");
  return { ok: true };
}

export type CorteDatos = {
  totalVentas: number;
  totalCobros: number;
  efectivoEsperado: number;
  efectivoContado: number | null;
  diferencia: number | null;
  totalProductos: number;
  pacientesAtendidos: number;
  desglose: Record<string, number>;
};

export async function registrarCorte(datos: CorteDatos): Promise<CorteResult> {
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
    // Rango del corte: del inicio del día (Sinaloa) al momento del cierre. Define
    // qué movimientos pertenecen a este corte al verlo en el historial.
    apertura: inicioDiaSinaloa().toISOString(),
    cierre: new Date().toISOString(),
    total_ventas: datos.totalVentas,
    total_cobros: datos.totalCobros,
    total_efectivo: datos.efectivoEsperado, // efectivo esperado en el cajón
    efectivo_contado: datos.efectivoContado,
    diferencia: datos.diferencia,
    total_productos: datos.totalProductos,
    pacientes_atendidos: datos.pacientesAtendidos,
    desglose: datos.desglose,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/caja");
  return { ok: true };
}
