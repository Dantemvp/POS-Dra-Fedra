import { describe, expect, it } from "vitest";
import {
  INBODY_MAX_BYTES,
  INBODY_NUMERIC_KEYS,
  INBODY_TEXT_KEYS,
  parsearRespuestaInBody,
  validarArchivoInBody,
} from "./inbody";

function respuestaValida(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    ...Object.fromEntries(INBODY_NUMERIC_KEYS.map((key) => [key, null])),
    ...Object.fromEntries(INBODY_TEXT_KEYS.map((key) => [key, null])),
    peso_kg: 81.4,
    grasa_visceral: 7,
    fecha_prueba: "22.08.2026",
    ...overrides,
  });
}

describe("validarArchivoInBody", () => {
  it("acepta formatos de visión dentro del límite", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "image/gif"]) {
      expect(validarArchivoInBody({ type, size: 1024 })).toEqual({ ok: true });
    }
  });

  it("rechaza HEIC, PDF, archivos vacíos y archivos mayores de 10 MiB", () => {
    expect(validarArchivoInBody({ type: "image/heic", size: 1024 }).ok).toBe(false);
    expect(validarArchivoInBody({ type: "application/pdf", size: 1024 }).ok).toBe(false);
    expect(validarArchivoInBody({ type: "image/jpeg", size: 0 }).ok).toBe(false);
    expect(
      validarArchivoInBody({ type: "image/jpeg", size: INBODY_MAX_BYTES + 1 }).ok,
    ).toBe(false);
  });
});

describe("parsearRespuestaInBody", () => {
  it("normaliza una respuesta estructurada válida", () => {
    const result = parsearRespuestaInBody(respuestaValida());
    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        datos: expect.objectContaining({ peso_kg: 81.4, grasa_visceral: 7 }),
      }),
    );
  });

  it("rechaza JSON inválido, arreglos y campos desconocidos", () => {
    expect(parsearRespuestaInBody("no-json").ok).toBe(false);
    expect(parsearRespuestaInBody("[]").ok).toBe(false);
    expect(parsearRespuestaInBody(respuestaValida({ inventado: 123 })).ok).toBe(false);
  });

  it("rechaza tipos incorrectos, valores negativos y no finitos", () => {
    expect(parsearRespuestaInBody(respuestaValida({ peso_kg: "81.4" })).ok).toBe(false);
    expect(parsearRespuestaInBody(respuestaValida({ peso_kg: -1 })).ok).toBe(false);
    const noFinito = respuestaValida().replace('"peso_kg":81.4', '"peso_kg":1e400');
    expect(parsearRespuestaInBody(noFinito).ok).toBe(false);
  });

  it("rechaza una respuesta sin una sola medición", () => {
    const vacia = JSON.stringify({
      ...Object.fromEntries(INBODY_NUMERIC_KEYS.map((key) => [key, null])),
      ...Object.fromEntries(INBODY_TEXT_KEYS.map((key) => [key, null])),
    });
    expect(parsearRespuestaInBody(vacia).ok).toBe(false);
  });
});
