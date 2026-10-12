"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fechaSinaloa } from '@/lib/tz';
import { getUsuarioActual } from '@/lib/auth';
import { leerCajaDia } from '@/lib/caja-lectura';
import { centavosCorte, type ComprobanteCorte } from '@/lib/corte-resumen';

export type CorteResult = { ok: boolean; error?: string; corte?: ComprobanteCorte };

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
  const perfil = await getUsuarioActual();
  if (!perfil || !['admin', 'farmacia', 'gerente'].includes(perfil.rol)) return { ok: false, error: 'No tienes permiso para cerrar caja.' };
  const contado = datos.efectivoContado;
  if (contado === null || !Number.isFinite(contado) || contado < 0 || Math.abs(contado * 100 - Math.round(contado * 100)) > 0.000001) {
    return { ok: false, error: 'Captura el efectivo contado, con máximo dos decimales.' };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sin sesión." };

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("id, rol, activo")
    .eq("auth_uid", user.id)
    .single();
  if (!usuario || !usuario.activo || usuario.rol !== perfil.rol) return { ok: false, error: "Usuario sin permiso o desactivado." };
  let resumen;
  try { resumen = await leerCajaDia(); } catch (e) { return { ok: false, error: e instanceof Error ? e.message : 'No se pudo comprobar la caja.' }; }
  if (resumen.diferenciaPagos !== 0) return { ok: false, error: 'Los pagos no cuadran con los ingresos. Revisa el desglose antes de cerrar.' };
  const diferencia = (centavosCorte(contado) - centavosCorte(resumen.efectivoEsperado)) / 100;

  const { data: guardado, error } = await supabase.from("cortes_caja").insert({
    usuario_id: usuario.id,
    // Rango del corte: del inicio del día (Sinaloa) al momento del cierre. Define
    // qué movimientos pertenecen a este corte al verlo en el historial.
    apertura: resumen.apertura,
    cierre: resumen.cierre,
    total_ventas: resumen.totalVentas,
    total_cobros: resumen.totalCobros,
    total_efectivo: resumen.efectivoEsperado,
    efectivo_contado: contado,
    diferencia,
    total_productos: resumen.productosSalidos,
    pacientes_atendidos: resumen.pacientesAtendidos,
    desglose: resumen.desglose,
  }).select('id').single();
  if (error) return { ok: false, error: error.message };
  if (!guardado?.id) return { ok: false, error: 'No se pudo comprobar el folio guardado. Revisa el historial antes de reintentar.' };

  revalidatePath("/caja");
  revalidatePath('/cortes');
  return { ok: true, corte: { id: guardado.id, apertura: resumen.apertura, cierre: resumen.cierre, fecha: fechaSinaloa(resumen.cierre), responsable: perfil.nombre,
    totalVentas: resumen.totalVentas, totalCobros: resumen.totalCobros, efectivoEsperado: resumen.efectivoEsperado, efectivoContado: contado, diferencia,
    productos: resumen.productosSalidos, pacientes: resumen.pacientesAtendidos, desglose: resumen.desglose, numVentas: resumen.numVentas } };
}
