import { describe, expect, it } from "vitest";
import { contenidoCabeEnArea } from "./impresion-documento";

describe("contenidoCabeEnArea", () => {
  it("acepta contenido que termina antes del límite", () => {
    expect(
      contenidoCabeEnArea({ contenidoInferior: 500, limiteSuperior: 600 }),
    ).toBe(true);
  });

  it("acepta el contacto exacto y una tolerancia de redondeo", () => {
    expect(
      contenidoCabeEnArea({ contenidoInferior: 600, limiteSuperior: 600 }),
    ).toBe(true);
    expect(
      contenidoCabeEnArea({
        contenidoInferior: 600.75,
        limiteSuperior: 600,
        tolerancia: 1,
      }),
    ).toBe(true);
  });

  it("rechaza contenido que invade el área reservada", () => {
    expect(
      contenidoCabeEnArea({ contenidoInferior: 602, limiteSuperior: 600 }),
    ).toBe(false);
  });

  it("falla cerrado ante mediciones inválidas", () => {
    expect(
      contenidoCabeEnArea({
        contenidoInferior: Number.NaN,
        limiteSuperior: 600,
      }),
    ).toBe(false);
    expect(
      contenidoCabeEnArea({
        contenidoInferior: 500,
        limiteSuperior: 600,
        tolerancia: -1,
      }),
    ).toBe(false);
  });
});
