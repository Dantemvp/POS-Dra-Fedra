export type PagoVenta = { metodo: string; monto: number };

export type PrepararPagoResult =
  | { ok: true; pagos: PagoVenta[] | null; montoEfectivo: number }
  | { ok: false; error: string };

export function redondearDinero(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

export function calcularTotal(
  lineas: ReadonlyArray<{ precio: number; cantidad: number }>,
): number {
  return redondearDinero(
    lineas.reduce((total, linea) => total + linea.precio * linea.cantidad, 0),
  );
}

export function prepararPago(
  totalSinRedondear: number,
  dividir: boolean,
  metodo: string,
  montoPrincipal: string | number,
  metodoSecundario: string,
): PrepararPagoResult {
  const total = redondearDinero(totalSinRedondear);
  if (!Number.isFinite(total) || total <= 0) {
    return { ok: false, error: "El total de la venta debe ser mayor a cero." };
  }

  if (!dividir) {
    return {
      ok: true,
      pagos: null,
      montoEfectivo: metodo === "efectivo" ? total : 0,
    };
  }

  if (metodo === metodoSecundario) {
    return {
      ok: false,
      error: "Elige dos métodos distintos para dividir el pago.",
    };
  }

  const monto1 = redondearDinero(Number(montoPrincipal));
  if (!Number.isFinite(monto1) || monto1 <= 0 || monto1 >= total) {
    return {
      ok: false,
      error: `El monto en ${metodo} debe ser mayor a 0 y menor al total.`,
    };
  }

  const monto2 = redondearDinero(total - monto1);
  const pagos = [
    { metodo, monto: monto1 },
    { metodo: metodoSecundario, monto: monto2 },
  ];

  return {
    ok: true,
    pagos,
    montoEfectivo: redondearDinero(
      pagos
        .filter((pago) => pago.metodo === "efectivo")
        .reduce((suma, pago) => suma + pago.monto, 0),
    ),
  };
}

export function calcularCambio(
  recibido: string | number,
  montoEfectivo: number,
): number {
  if (typeof recibido === "string" && recibido.trim() === "") return 0;
  const recibidoNumero = Number(recibido);
  if (!Number.isFinite(recibidoNumero)) return 0;
  return redondearDinero(recibidoNumero - montoEfectivo);
}
