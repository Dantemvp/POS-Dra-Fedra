export const INBODY_NUMERIC_KEYS = [
  "peso_kg",
  "masa_muscular_kg",
  "grasa_corporal_kg",
  "grasa_pct",
  "imc",
  "grasa_visceral",
  "tmb_kcal",
  "agua_total_l",
  "proteinas_kg",
  "minerales_kg",
  "masa_libre_grasa_kg",
  "relacion_cintura_cadera",
  "grado_obesidad_pct",
  "altura_cm",
  "edad",
  "puntuacion_inbody",
] as const;

export const INBODY_TEXT_KEYS = ["grasa_visceral_linea", "fecha_prueba"] as const;

export type InBodyNumericKey = (typeof INBODY_NUMERIC_KEYS)[number];
export type InBodyTextKey = (typeof INBODY_TEXT_KEYS)[number];
export type InBodyDatos = Partial<
  Record<InBodyNumericKey, number | null> & Record<InBodyTextKey, string | null>
>;

export const INBODY_MIME_PERMITIDOS = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;
export const INBODY_MAX_BYTES = 10 * 1024 * 1024;
export const INBODY_OPENAI_MODEL = "gpt-4o-2024-08-06";

export type ArchivoInBody = { type: string; size: number };

export function validarArchivoInBody(
  archivo: ArchivoInBody,
): { ok: true } | { ok: false; error: string } {
  if (!INBODY_MIME_PERMITIDOS.includes(archivo.type as (typeof INBODY_MIME_PERMITIDOS)[number])) {
    return { ok: false, error: "El InBody debe ser una imagen JPG, PNG, WEBP o GIF." };
  }
  if (!Number.isFinite(archivo.size) || archivo.size <= 0) {
    return { ok: false, error: "El archivo de InBody está vacío o no es válido." };
  }
  if (archivo.size > INBODY_MAX_BYTES) {
    return { ok: false, error: "La imagen de InBody supera el máximo de 10 MiB." };
  }
  return { ok: true };
}

const propiedadesNumericas = Object.fromEntries(
  INBODY_NUMERIC_KEYS.map((key) => [
    key,
    { anyOf: [{ type: "number" }, { type: "null" }] },
  ]),
);
const propiedadesTexto = Object.fromEntries(
  INBODY_TEXT_KEYS.map((key) => [
    key,
    { anyOf: [{ type: "string" }, { type: "null" }] },
  ]),
);

export const INBODY_RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "inbody_extraction",
    strict: true,
    schema: {
      type: "object",
      properties: { ...propiedadesNumericas, ...propiedadesTexto },
      required: [...INBODY_NUMERIC_KEYS, ...INBODY_TEXT_KEYS],
      additionalProperties: false,
    },
  },
} as const;

const clavesPermitidas = new Set<string>([
  ...INBODY_NUMERIC_KEYS,
  ...INBODY_TEXT_KEYS,
]);

export function parsearRespuestaInBody(
  contenido: string,
): { ok: true; datos: InBodyDatos } | { ok: false; error: string } {
  if (contenido.length > 20_000) {
    return { ok: false, error: "La respuesta de IA excede el tamaño permitido." };
  }

  let valor: unknown;
  try {
    valor = JSON.parse(contenido);
  } catch {
    return { ok: false, error: "La IA devolvió una respuesta que no es JSON válido." };
  }
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) {
    return { ok: false, error: "La IA no devolvió un objeto de datos InBody." };
  }

  const entrada = valor as Record<string, unknown>;
  const desconocidas = Object.keys(entrada).filter((key) => !clavesPermitidas.has(key));
  if (desconocidas.length > 0) {
    return { ok: false, error: "La IA devolvió campos InBody no reconocidos." };
  }

  const datos: InBodyDatos = {};
  let encontrados = 0;
  for (const key of INBODY_NUMERIC_KEYS) {
    const actual = entrada[key];
    if (actual === null || actual === undefined) {
      datos[key] = null;
      continue;
    }
    if (typeof actual !== "number" || !Number.isFinite(actual) || actual < 0) {
      return { ok: false, error: `La IA devolvió un valor inválido para ${key}.` };
    }
    datos[key] = actual;
    encontrados++;
  }
  for (const key of INBODY_TEXT_KEYS) {
    const actual = entrada[key];
    if (actual === null || actual === undefined) {
      datos[key] = null;
      continue;
    }
    if (typeof actual !== "string" || actual.length > 120) {
      return { ok: false, error: `La IA devolvió un texto inválido para ${key}.` };
    }
    datos[key] = actual.trim();
    if (datos[key]) encontrados++;
  }

  if (encontrados === 0) {
    return { ok: false, error: "La IA no pudo extraer ningún dato del InBody." };
  }
  return { ok: true, datos };
}
