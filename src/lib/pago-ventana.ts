export const METODOS_PAGO = [
  { valor: 'efectivo', nombre: 'Efectivo' },
  { valor: 'tarjeta', nombre: 'Tarjeta' },
  { valor: 'transferencia', nombre: 'Transferencia' },
  { valor: 'otro', nombre: 'Otro' },
] as const;
export type MetodoPago = typeof METODOS_PAGO[number]['valor'];
export type PagoVentana = { metodo: MetodoPago; dividir: boolean; metodo2: MetodoPago; monto1: string };

export function prepararPago(total: number, datos: PagoVentana) {
  const centavos = Math.round(total * 100);
  if (!Number.isFinite(total) || !Number.isSafeInteger(centavos) || centavos < 0) return { error: 'Revisa el total antes de cobrar.' } as const;
  if (!METODOS_PAGO.some(m => m.valor === datos.metodo)) return { error: 'Elige un método de pago válido.' } as const;
  if (!datos.dividir) return { pagos: undefined, efectivo: datos.metodo === 'efectivo' ? centavos / 100 : 0 };
  const numero = Number(datos.monto1);
  const primero = Math.round(numero * 100);
  if (!METODOS_PAGO.some(m => m.valor === datos.metodo2) || datos.metodo === datos.metodo2) return { error: 'Elige dos métodos distintos.' } as const;
  if (!datos.monto1.trim() || !Number.isFinite(numero) || Math.abs(numero * 100 - primero) > 0.000001 || primero <= 0 || primero >= centavos) return { error: 'El primer monto debe ser mayor a cero y menor al total, con máximo dos decimales.' } as const;
  const pagos = [{ metodo: datos.metodo, monto: primero / 100 }, { metodo: datos.metodo2, monto: (centavos - primero) / 100 }];
  return { pagos, efectivo: pagos.find(p => p.metodo === 'efectivo')?.monto ?? 0 };
}

export function revisarRecibido(texto: string, efectivo: number) {
  if (!texto.trim() || efectivo === 0) return {};
  const recibido = Number(texto);
  if (!Number.isFinite(recibido) || recibido < 0 || Math.abs(recibido * 100 - Math.round(recibido * 100)) > 0.000001) return { error: 'Captura un efectivo recibido válido, con máximo dos decimales.' };
  const cambio = (Math.round(recibido * 100) - Math.round(efectivo * 100)) / 100;
  if (cambio < 0) return { error: 'El efectivo recibido no alcanza para cubrir el pago.' };
  return { recibido, cambio };
}
