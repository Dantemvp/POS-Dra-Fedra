import { redondearDinero } from "./dinero";

type Pago = { metodo: string; monto: number };

export type VentaCaja = {
  total: number;
  metodo_pago: string | null;
  pagos: Pago[];
  venta_items: { cantidad: number }[];
};

export type CobroCaja = {
  total: number;
  paciente_id: string | null;
  cobro_pagos: Pago[];
};

export function resumirCaja(ventas: VentaCaja[], cobros: CobroCaja[]) {
  const totalVentas = redondearDinero(
    ventas.reduce((suma, venta) => suma + Number(venta.total), 0),
  );
  const totalCobros = redondearDinero(
    cobros.reduce((suma, cobro) => suma + Number(cobro.total), 0),
  );
  const totalProductos = ventas.reduce(
    (suma, venta) =>
      suma +
      (venta.venta_items ?? []).reduce(
        (subtotal, item) => subtotal + Number(item.cantidad),
        0,
      ),
    0,
  );
  const pacientesAtendidos = cobros.filter((cobro) => cobro.paciente_id).length;
  const desglose: Record<string, number> = {};

  for (const venta of ventas) {
    const pagos = venta.pagos ?? [];
    if (pagos.length === 0) {
      const metodo = venta.metodo_pago ?? "otro";
      desglose[metodo] = redondearDinero(
        (desglose[metodo] ?? 0) + Number(venta.total),
      );
      continue;
    }
    for (const pago of pagos) {
      desglose[pago.metodo] = redondearDinero(
        (desglose[pago.metodo] ?? 0) + Number(pago.monto),
      );
    }
  }

  for (const cobro of cobros) {
    for (const pago of cobro.cobro_pagos ?? []) {
      desglose[pago.metodo] = redondearDinero(
        (desglose[pago.metodo] ?? 0) + Number(pago.monto),
      );
    }
  }

  return {
    totalVentas,
    totalCobros,
    totalProductos,
    pacientesAtendidos,
    efectivoEsperado: redondearDinero(desglose.efectivo ?? 0),
    desglose,
  };
}
