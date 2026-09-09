import { describe, expect, it } from "vitest";
import { formatearVersion } from "./version";

describe("formatearVersion", () => {
  it("muestra versión y commit corto", () => {
    expect(formatearVersion("0.2.0", "1234567890")).toEqual({
      version: "0.2.0",
      commit: "1234567",
      etiqueta: "v0.2.0 · 1234567",
    });
  });

  it("usa valores seguros cuando faltan metadatos", () => {
    expect(formatearVersion("", "").etiqueta).toBe("vsin-versión · local");
  });
});
