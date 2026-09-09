import { describe, expect, it } from "vitest";
import {
  calcularCambio,
  calcularTotal,
  prepararPago,
  redondearDinero,
} from "./dinero";

describe("dinero", () => {
  it("redondea a centavos sin conservar ruido binario", () => {
    expect(redondearDinero(0.1 + 0.2)).toBe(0.3);
    expect(calcularTotal([{ precio: 33.335, cantidad: 3 }])).toBe(100.01);
  });

  it("prepara un pago simple en efectivo", () => {
    expect(prepararPago(100.1, false, "efectivo", "", "tarjeta")).toEqual({
      ok: true,
      pagos: null,
      montoEfectivo: 100.1,
    });
  });

  it("divide el pago y conserva exactamente el total", () => {
    expect(prepararPago(100.1, true, "tarjeta", "40.05", "efectivo")).toEqual({
      ok: true,
      pagos: [
        { metodo: "tarjeta", monto: 40.05 },
        { metodo: "efectivo", monto: 60.05 },
      ],
      montoEfectivo: 60.05,
    });
  });

  it("rechaza métodos repetidos y montos fuera del total", () => {
    expect(prepararPago(100, true, "efectivo", 40, "efectivo")).toMatchObject({ ok: false });
    expect(prepararPago(100, true, "efectivo", 100, "tarjeta")).toMatchObject({ ok: false });
    expect(prepararPago(100, true, "efectivo", "texto", "tarjeta")).toMatchObject({ ok: false });
  });

  it("calcula cambio y faltante con centavos exactos", () => {
    expect(calcularCambio(200, 160.05)).toBe(39.95);
    expect(calcularCambio(150, 160.05)).toBe(-10.05);
    expect(calcularCambio(0, 160.05)).toBe(-160.05);
    expect(calcularCambio("", 160.05)).toBe(0);
  });
});
