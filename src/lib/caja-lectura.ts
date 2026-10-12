import { createClient } from '@/lib/supabase/server';
import { resumenCorte, leerDesgloseCorte, type VentaCorte, type CobroCorte, type ComprobanteCorte } from './corte-resumen';
import { inicioDiaSinaloa, fechaSinaloa } from './tz';

// Solo lectura con el cliente de la sesión, nunca service_role.
export async function leerCajaDia(hasta = new Date()) {
  const supabase = await createClient();
  const desde = inicioDiaSinaloa(hasta).toISOString();
  const [ventas, cobros] = await Promise.all([
    supabase.from('ventas').select('id, folio, fecha, total, metodo_pago, venta_items(cantidad, precio_unit, productos(nombre)), pagos(metodo, monto)', { count: 'exact' })
      .gte('fecha', desde).lte('fecha', hasta.toISOString()).eq('estado', 'pagada').eq('es_historico', false).order('fecha', { ascending: false }).limit(1001),
    supabase.from('cobros').select('id, total, paciente_id, cobro_pagos(metodo, monto)', { count: 'exact' })
      .gte('fecha', desde).lte('fecha', hasta.toISOString()).eq('estado', 'activo').limit(1001),
  ]);
  if (ventas.error || cobros.error) throw new Error('No se pudo comprobar la caja. No cierres con datos incompletos.');
  if ((ventas.count ?? ventas.data?.length ?? 0) > 1000 || (cobros.count ?? cobros.data?.length ?? 0) > 1000) throw new Error('El resumen requiere paginación antes de cerrar este volumen de operaciones.');
  return { apertura: desde, cierre: hasta.toISOString(), ventas: ventas.data ?? [], cobros: cobros.data ?? [],
    ...resumenCorte((ventas.data ?? []) as unknown as VentaCorte[], (cobros.data ?? []) as unknown as CobroCorte[]) };
}

// Recuperación en Caja para el cajero, sin abrirle la ruta /cortes de gerencia.
export async function leerUltimoCortePropio(responsable: string): Promise<ComprobanteCorte | null> {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const perfil = await db.from('usuarios').select('id').eq('auth_uid', user.id).single();
  if (perfil.error || !perfil.data) return null;
  const { data: c, error } = await db.from('cortes_caja').select('id, apertura, cierre, total_ventas, total_cobros, total_efectivo, efectivo_contado, diferencia, total_productos, pacientes_atendidos, desglose')
    .eq('usuario_id', perfil.data.id).not('cierre', 'is', null).order('cierre', { ascending: false }).limit(1).maybeSingle();
  if (error || !c) return null;
  return { id: c.id, apertura: c.apertura, cierre: c.cierre, fecha: fechaSinaloa(c.cierre), responsable,
    totalVentas: Number(c.total_ventas ?? 0), totalCobros: Number(c.total_cobros ?? 0), efectivoEsperado: Number(c.total_efectivo ?? 0),
    efectivoContado: c.efectivo_contado === null ? null : Number(c.efectivo_contado), diferencia: c.diferencia === null ? null : Number(c.diferencia),
    productos: c.total_productos, pacientes: c.pacientes_atendidos, ...leerDesgloseCorte(c.desglose) };
}
