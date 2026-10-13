// Sustituye la acción real exclusivamente en el harness aislado --cierre.
import type { CorteDatos, CorteResult } from '../../src/app/(app)/caja/actions';

let llamadas = 0;
export async function registrarCorte(datos: CorteDatos): Promise<CorteResult> {
  llamadas++;
  window.dispatchEvent(new CustomEvent('cierre-demo', { detail: llamadas }));
  await new Promise(resolve => setTimeout(resolve, 150));
  const modo = new URLSearchParams(location.search).get('modo');
  if (modo === 'incierto') throw new Error('Resultado incierto ficticio');
  if (modo === 'error') return { ok: false, error: 'Cierre rechazado ficticio.' };
  const farmacia = datos.area === 'farmacia';
  // Distintos de la vista previa: permite verificar que manda la respuesta guardada.
  return { ok: true, corte: {
    id: 'CORTE-FICTICIO-GUARDADO', area: datos.area, fecha: '12/10/2026', responsable: 'Responsable ficticio',
    totalVentas: farmacia ? 1020 : 0, totalCobros: farmacia ? 0 : 520,
    efectivoEsperado: farmacia ? 620 : 220, efectivoContado: datos.efectivoContado,
    diferencia: (datos.efectivoContado ?? 0) - (farmacia ? 620 : 220),
    productos: farmacia ? 3 : 0, pacientes: farmacia ? 0 : 2,
    desglose: farmacia ? { efectivo: 620, tarjeta: 400 } : { efectivo: 220, tarjeta: 300 },
    farmaciaIncluida: farmacia, consultorioIncluido: !farmacia,
  } };
}
