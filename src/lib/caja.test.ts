import { describe, expect, it } from "vitest";
import { resumirCaja } from "./caja";

describe("resumirCaja", () => {
  it("suma pagos mixtos, ventas antiguas y cobros sin duplicar efectivo", () => {
    const resumen = resumirCaja(
      [
        {
          total: 100,
          metodo_pago: "mixto",
          pagos: [
            { metodo: "efectivo", monto: 40 },
            { metodo: "tarjeta", monto: 60 },
          ],
          venta_items: [{ cantidad: 2 }, { cantidad: 1 }],
        },
        {
          total: 25.5,
          metodo_pago: "efectivo",
          pagos: [],
          venta_items: [{ cantidad: 1 }],
        },
      ],
      [
        {
          total: 80,
          paciente_id: "paciente-1",
          cobro_pagos: [{ metodo: "efectivo", monto: 80 }],
        },
        {
          total: 20,
          paciente_id: null,
          cobro_pagos: [{ metodo: "transferencia", monto: 20 }],
        },
      ],
    );

    expect(resumen).toEqual({
      totalVentas: 125.5,
      totalCobros: 100,
      totalProductos: 4,
      pacientesAtendidos: 1,
      efectivoEsperado: 145.5,
      desglose: { efectivo: 145.5, tarjeta: 60, transferencia: 20 },
    });
  });

  it("redondea acumulaciones monetarias a centavos", () => {
    const resumen = resumirCaja(
      [{ total: 0.1 + 0.2, metodo_pago: "efectivo", pagos: [], venta_items: [] }],
      [],
    );
    expect(resumen.totalVentas).toBe(0.3);
    expect(resumen.efectivoEsperado).toBe(0.3);
  });
});
