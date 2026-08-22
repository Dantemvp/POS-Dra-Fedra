import { describe, expect, it } from "vitest";
import { planificarPaginas } from "./paginacion-documento";

describe("planificarPaginas", () => {
  it("conserva un documento corto en una sola página", () => {
    expect(planificarPaginas(500, 700)).toEqual([{ inicio: 0, alto: 500 }]);
  });

  it("divide por el alto máximo cuando no hay bloques protegidos", () => {
    expect(planificarPaginas(1500, 700)).toEqual([
      { inicio: 0, alto: 700 },
      { inicio: 700, alto: 700 },
      { inicio: 1400, alto: 100 },
    ]);
  });

  it("mueve el corte antes de una sección atravesada", () => {
    expect(planificarPaginas(1200, 700, [{ inicio: 650, fin: 820 }])).toEqual([
      { inicio: 0, alto: 650 },
      { inicio: 650, alto: 550 },
    ]);
  });

  it("elige el inicio más temprano cuando se superponen bloques", () => {
    expect(
      planificarPaginas(1300, 700, [
        { inicio: 680, fin: 760 },
        { inicio: 640, fin: 730 },
      ]),
    ).toEqual([
      { inicio: 0, alto: 640 },
      { inicio: 640, alto: 660 },
    ]);
  });

  it("corta un bloque mayor que una página para no quedar en ciclo", () => {
    expect(planificarPaginas(1600, 700, [{ inicio: 0, fin: 1500 }])).toEqual([
      { inicio: 0, alto: 700 },
      { inicio: 700, alto: 700 },
      { inicio: 1400, alto: 200 },
    ]);
  });

  it("recorta rangos inválidos sin crear páginas vacías", () => {
    expect(
      planificarPaginas(900, 700, [
        { inicio: -20, fin: 10 },
        { inicio: 950, fin: 1000 },
        { inicio: Number.NaN, fin: 20 },
      ]),
    ).toEqual([
      { inicio: 0, alto: 700 },
      { inicio: 700, alto: 200 },
    ]);
  });

  it("rechaza alturas que no permiten avanzar", () => {
    expect(() => planificarPaginas(0, 700)).toThrow("altoTotal");
    expect(() => planificarPaginas(700, 0)).toThrow("altoMaximo");
  });
});
