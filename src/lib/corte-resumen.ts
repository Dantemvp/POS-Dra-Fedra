export type PagoCorte = { metodo: string; monto: number | string };
export type VentaCorte = { total: number | string; metodo_pago: string | null; pagos: PagoCorte[]; venta_items: { cantidad: number }[] };
export type CobroCorte = { total: number | string; paciente_id: string | null; cobro_pagos: PagoCorte[] };

export function centavosCorte(valor: number | string) {
  const n = Number(valor);
  if (!Number.isFinite(n) || n < 0 || !Number.isSafeInteger(Math.round(n * 100))) throw new Error('Importe inválido en caja.');
  return Math.round(n * 100);
}

export function resumenCorte(ventas: VentaCorte[], cobros: CobroCorte[]) {
  const metodos: Record<string, number> = {};
  const sumar = (pagos: PagoCorte[]) => { for (const p of pagos) metodos[p.metodo] = (metodos[p.metodo] ?? 0) + centavosCorte(p.monto); };
  for (const v of ventas) sumar(v.pagos?.length ? v.pagos : [{ metodo: v.metodo_pago ?? 'otro', monto: v.total }]);
  for (const c of cobros) sumar(c.cobro_pagos ?? []);
  const ventasCent = ventas.reduce((s, v) => s + centavosCorte(v.total), 0);
  const cobrosCent = cobros.reduce((s, c) => s + centavosCorte(c.total), 0);
  const sumaPagos = Object.values(metodos).reduce((s, n) => s + n, 0);
  return { totalVentas: ventasCent / 100, totalCobros: cobrosCent / 100, numVentas: ventas.length,
    productosSalidos: ventas.reduce((s, v) => s + (v.venta_items ?? []).reduce((a, i) => a + Number(i.cantidad), 0), 0),
    pacientesAtendidos: new Set(cobros.map(c => c.paciente_id).filter(Boolean)).size,
    efectivoEsperado: (metodos.efectivo ?? 0) / 100,
    desglose: Object.fromEntries(Object.entries(metodos).map(([m, n]) => [m, n / 100])),
    diferenciaPagos: (ventasCent + cobrosCent - sumaPagos) / 100,
  };
}

export type ComprobanteCorte = {
  id?: string; apertura?: string | null; cierre?: string; fecha: string; responsable: string;
  totalVentas: number; totalCobros: number; efectivoEsperado: number; efectivoContado: number | null;
  diferencia: number | null; productos: number | null; pacientes: number | null;
  desglose: Record<string, number>; numVentas?: number; consultorioIncluido?: boolean; farmaciaIncluida?: boolean; area?: AreaCorte;
};
export type AreaCorte = 'farmacia' | 'consultorio';
export function puedeCerrarArea(rol: string, area: AreaCorte) {
  return ['admin', 'gerente'].includes(rol) || (rol === 'farmacia' && area === 'farmacia');
}
export function etiquetaAreaCorte(c: Pick<ComprobanteCorte, 'area' | 'consultorioIncluido'>) {
  return c.area === 'consultorio' ? 'Consultorio' : c.area === 'farmacia' || c.consultorioIncluido === false ? 'Farmacia' : 'Anterior: alcance combinado o no registrado';
}
// Metadato en el JSON existente, no un método ni un importe. Conserva el alcance
// del cierre aunque cambie después el rol de quien lo realizó. Sin migración.
const CLAVE_SOLO_FARMACIA = '__solo_farmacia';
export function guardarDesgloseCorte(desglose: Record<string, number>, alcance: boolean | AreaCorte) {
  return { ...leerDesgloseCorte(desglose).desglose, [CLAVE_SOLO_FARMACIA]: alcance === 'farmacia' || alcance === false ? 1 : 0,
    ...(typeof alcance === 'string' ? { __area_corte: alcance === 'farmacia' ? 1 : 2 } : {}) };
}
export function leerDesgloseCorte(valor: Record<string, number> | null) {
  const { [CLAVE_SOLO_FARMACIA]: soloFarmacia, __area_corte: codigoArea, ...desglose } = valor ?? {};
  const area: AreaCorte | undefined = codigoArea === 2 ? 'consultorio' : codigoArea === 1 || soloFarmacia === 1 ? 'farmacia' : undefined;
  return { desglose, area, farmaciaIncluida: area !== 'consultorio', consultorioIncluido: area ? area === 'consultorio' : soloFarmacia === 0 ? true : undefined };
}
export const METODOS_CORTE: Record<string, string> = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia', otro: 'Otro' };
const celdaCSV = (valor: unknown) => {
  let texto = String(valor ?? '');
  if (/^[=+@-]/.test(texto) && !/^-?\d+(\.\d+)?$/.test(texto)) texto = `'${texto}`;
  return `"${texto.replaceAll('"', '""')}"`;
};
export function csvCorte(c: ComprobanteCorte) {
  const filas: unknown[][] = [['Concepto', 'Valor'], ['Tipo', c.id ? 'Corte guardado' : 'Vista previa'], ['Folio', c.id ?? 'Sin guardar'], ['Fecha (Sinaloa)', c.fecha],
    ['Responsable', c.responsable], ['Área', etiquetaAreaCorte(c)], ['Farmacia', c.farmaciaIncluida === false ? 'No incluida en este corte' : c.totalVentas.toFixed(2)], ['Consultorio', c.consultorioIncluido === false ? 'No incluido en este corte' : c.totalCobros.toFixed(2)],
    ['Total', ((centavosCorte(c.totalVentas) + centavosCorte(c.totalCobros)) / 100).toFixed(2)],
    ...Object.entries(c.desglose).map(([m, n]) => [`Pago: ${METODOS_CORTE[m] ?? m}`, n.toFixed(2)]),
    ['Efectivo recibido esperado', c.efectivoEsperado.toFixed(2)], ['Efectivo contado', c.efectivoContado?.toFixed(2) ?? 'Sin capturar'],
    ['Diferencia', c.diferencia?.toFixed(2) ?? 'Sin determinar'], ['Productos salidos', c.farmaciaIncluida === false ? 'No incluidos en este corte' : c.productos ?? 'No registrado'], ['Pacientes atendidos', c.consultorioIncluido === false ? 'No incluido en este corte' : c.pacientes ?? 'No registrado']];
  if (c.consultorioIncluido === undefined) filas.push(['Alcance', 'Este corte anterior no registró si incluía consultorio.']);
  return '\uFEFF' + filas.map(f => f.map(celdaCSV).join(',')).join('\r\n');
}
