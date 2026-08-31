import { describe, expect, it } from "vitest";
import { contenidoCabeEnArea, edadEnFecha } from "./impresion-documento";

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

describe("edadEnFecha", () => {
  it("calcula la edad exacta en la fecha de la receta", () => {
    expect(edadEnFecha("1990-08-22", "2026-08-22")).toBe("36");
    expect(edadEnFecha("1990-08-23", "2026-08-22")).toBe("35");
  });

  it("conserva la edad histórica al reimprimir", () => {
    expect(edadEnFecha("2000-01-01", "2020-06-15T18:00:00Z")).toBe("20");
  });

  it("resuelve nacimientos en 29 de febrero por calendario", () => {
    expect(edadEnFecha("2000-02-29", "2024-02-28")).toBe("23");
    expect(edadEnFecha("2000-02-29", "2024-02-29")).toBe("24");
  });

  it("falla cerrado con fechas imposibles o anteriores al nacimiento", () => {
    expect(edadEnFecha("2000-02-30", "2026-01-01")).toBe("");
    expect(edadEnFecha("2000-01-01", "1999-12-31")).toBe("");
    expect(edadEnFecha(null, "2026-01-01")).toBe("");
  });
});
