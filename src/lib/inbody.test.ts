import { describe, expect, it } from "vitest";
import {
  INBODY_MAX_BYTES,
  INBODY_NUMERIC_KEYS,
  INBODY_OPENAI_MODEL,
  INBODY_TEXT_KEYS,
  parsearRespuestaInBody,
  rutaInBody,
  validarArchivoInBody,
} from "./inbody";

describe("configuracion de OpenAI para InBody", () => {
  it("fija un modelo compatible con json_schema", () => {
    expect(INBODY_OPENAI_MODEL).toBe("gpt-4o-2024-08-06");
  });
});

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

// La forma de esta ruta no es cosmética: `documentos_clinicos` tiene una
// restricción que exige exactamente `inbody/{paciente_id}/{archivo}`, y la
// política de alta del bucket rechaza cualquier otra. Una ruta mal armada no
// falla al subir, falla al registrar, y para entonces el objeto ya está
// guardado donde nadie lo puede borrar.
describe("ruta de un estudio dentro del bucket", () => {
  const paciente = "27e8af7e-5565-4791-b714-70ed415e0242";

  it("arma exactamente tres segmentos bajo inbody", () => {
    const partes = rutaInBody(paciente, "image/jpeg").split("/");
    expect(partes).toHaveLength(3);
    expect(partes[0]).toBe("inbody");
    expect(partes[1]).toBe(paciente);
    expect(partes[2]).not.toBe("");
  });

  it("traduce el tipo del archivo a una extensión conocida", () => {
    expect(rutaInBody(paciente, "image/jpeg").endsWith(".jpg")).toBe(true);
    expect(rutaInBody(paciente, "image/png").endsWith(".png")).toBe(true);
    expect(rutaInBody(paciente, "image/webp").endsWith(".webp")).toBe(true);
    expect(rutaInBody(paciente, "image/gif").endsWith(".gif")).toBe(true);
  });

  it("no repite la ruta entre dos capturas seguidas", () => {
    // Con una marca de tiempo, dos capturas en el mismo milisegundo desde dos
    // pestañas colisionaban contra la unicidad de `path`.
    const rutas = new Set(
      Array.from({ length: 50 }, () => rutaInBody(paciente, "image/png")),
    );
    expect(rutas.size).toBe(50);
  });

  it("no deja que el nombre del archivo entre a la ruta", () => {
    // Un nombre con diagonal metería un cuarto segmento y volvería la ruta
    // irregistrable. El nombre lo pone el sistema, no quien sube.
    const ruta = rutaInBody(paciente, "image/png");
    expect(ruta.split("/")).toHaveLength(3);
    expect(ruta).not.toContain(" ");
  });
});
