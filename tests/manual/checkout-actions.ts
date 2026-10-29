// Acciones exclusivas del harness: sin red, base de datos ni cobros reales.
import type { CobroInput, Result } from '../../src/app/(app)/cobros/actions';
import type { ItemVenta, PagoVenta, CobrarResult } from '../../src/app/(app)/ventas/actions';
let llamadas = 0;
async function simular(datos: unknown) {
  window.dispatchEvent(new CustomEvent('checkout-llamada', { detail: { llamadas: ++llamadas, datos } }));
  await new Promise(resolve => setTimeout(resolve, 350));
  const modo = new URLSearchParams(location.search).get('modo');
  if (modo === 'incierto') throw new Error('Fallo de red ficticio');
  return modo === 'error' ? 'Rechazo ficticio. No se registró el pago.' : '';
}
export async function cobrar(items: ItemVenta[], metodo: string, paciente: string | null, pagos: PagoVenta[] | null): Promise<CobrarResult> {
  const error = await simular({ items, metodo, paciente, pagos });
  return error ? { ok: false, error } : { ok: true, folio: 782, ventaId: 'VENTA-FICTICIA' };
}
export async function crearCobro(datos: CobroInput): Promise<Result> {
  const error = await simular(datos);
  return error ? { ok: false, error } : { ok: true, id: 'COBRO-FICTICIO' };
}
export async function cargarReceta() {
  return { ok: true, productoIds: ['producto-1'], sinLigar: [] };
}
