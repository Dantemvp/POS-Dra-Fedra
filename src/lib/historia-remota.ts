import type { CampoHistoria } from "./historia-campos";

export type RespuestasRemotas = {
  formato: "fedra-historia-paciente";
  version: 1;
  nombre: string;
  fecha_nac: string | null;
  sexo: "F" | "M" | null;
  respuestas: Record<string, unknown>;
};
export const MAX_RESPUESTAS_BYTES = 64 * 1024;

export function crearCamposRemotos(campos: CampoHistoria[]): CampoHistoria[] {
  const elegidos = campos.filter(c => !c.oculto && /^(I|II|III|IV|V|VI|VII|VIII|X|XII)\./.test(c.seccion ?? ""));
  const slug = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const ids = new Map(elegidos.map(c => [c.id, `q-${slug(c.seccion ?? "datos")}--${slug(c.etiqueta)}`]));
  if (new Set(ids.values()).size !== elegidos.length) throw new Error("La plantilla contiene preguntas duplicadas. Consulta al consultorio.");
  return elegidos.filter(c => !c.depende_de || ids.has(c.depende_de)).map(c => ({
    id: ids.get(c.id)!, etiqueta: c.etiqueta, seccion: c.seccion, tipo_dato: c.tipo_dato, opciones: c.opciones,
    orden: c.orden, requerido: false, oculto: false, valor_default: null, rol: null,
    solo_sexo: c.solo_sexo, depende_de: c.depende_de ? ids.get(c.depende_de) : null, depende_valor: c.depende_valor,
  }));
}

export function validarArchivoRemoto(texto: string, campos: CampoHistoria[]): RespuestasRemotas {
  if (new TextEncoder().encode(texto).length > MAX_RESPUESTAS_BYTES) throw new Error("El archivo supera 64 KB.");
  let v: RespuestasRemotas;
  try { v = JSON.parse(texto); } catch { throw new Error("El archivo no contiene respuestas válidas."); }
  if (!v || v.formato !== "fedra-historia-paciente" || v.version !== 1 || typeof v.nombre !== "string" || !v.nombre.trim() || v.nombre.length > 200 || !["F", "M", null].includes(v.sexo) || (v.fecha_nac !== null && (typeof v.fecha_nac !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v.fecha_nac))) || !v.respuestas || typeof v.respuestas !== "object" || Array.isArray(v.respuestas)) throw new Error("Revisa el nombre, formato y versión del archivo.");
  const permitidos = new Map(campos.map(c => [c.id, c]));
  const respuestas: Record<string, unknown> = {};
  for (const [id, respuesta] of Object.entries(v.respuestas)) {
    const c = permitidos.get(id);
    if (!c) throw new Error("El archivo contiene una pregunta desconocida.");
    if (respuesta == null || respuesta === "" || (Array.isArray(respuesta) && respuesta.length === 0)) continue;
    if (c.solo_sexo && v.sexo && v.sexo !== c.solo_sexo) throw new Error("Las respuestas no coinciden con el sexo declarado. Revisa el archivo.");
    if (c.depende_de && String(v.respuestas[c.depende_de]) !== String(c.depende_valor ?? "true")) throw new Error("Un detalle tiene una respuesta Sí/No contradictoria.");
    let valido = false;
    if (c.tipo_dato === "booleano") valido = typeof respuesta === "boolean";
    else if (c.tipo_dato === "numero") valido = typeof respuesta === "number" && Number.isFinite(respuesta) && respuesta >= 0 && respuesta < 1e6;
    else if (c.tipo_dato === "multi") valido = Array.isArray(respuesta) && respuesta.length <= (c.opciones?.length ?? 0) && respuesta.every(x => typeof x === "string" && c.opciones?.includes(x)) && !(respuesta.includes("Negado") && respuesta.length > 1);
    else if (c.tipo_dato === "opciones") valido = typeof respuesta === "string" && !!c.opciones?.includes(respuesta);
    else valido = typeof respuesta === "string" && respuesta.length <= (c.tipo_dato === "textarea" ? 5000 : 1000) && (c.tipo_dato !== "fecha" || /^\d{4}-\d{2}-\d{2}$/.test(respuesta));
    if (!valido) throw new Error(`Revisa la respuesta de ${c.etiqueta}.`);
    respuestas[id] = respuesta;
  }
  return { formato: "fedra-historia-paciente", version: 1, nombre: v.nombre.trim(), fecha_nac: v.fecha_nac, sexo: v.sexo, respuestas };
}

// Los UUID del expediente nunca salen en el enlace ni en el formulario público.
export function importarRespuestasRemotas(archivo: RespuestasRemotas, publicos: CampoHistoria[], destino: CampoHistoria[]): Record<string, unknown> {
  const salida: Record<string, unknown> = {};
  for (const [id, respuesta] of Object.entries(archivo.respuestas)) {
    const campo = publicos.find(c => c.id === id);
    const equivalentes = destino.filter(c => !c.oculto && c.etiqueta === campo?.etiqueta && c.seccion === campo?.seccion && c.tipo_dato === campo?.tipo_dato);
    if (equivalentes.length !== 1) throw new Error(`No se pudo ubicar ${campo?.etiqueta ?? "una pregunta"} en esta plantilla. Conserva el archivo para revisión.`);
    salida[equivalentes[0].id] = respuesta;
  }
  return salida;
}

export function textoRespuestasRemotas(archivo: RespuestasRemotas, campos: CampoHistoria[]): string {
  const lineas = [`Respuestas para el consultorio`, `Nombre declarado: ${archivo.nombre}`, ...(archivo.fecha_nac ? [`Nacimiento: ${archivo.fecha_nac}`] : []), ...(archivo.sexo ? [`Sexo declarado: ${archivo.sexo}`] : [])];
  for (const c of campos) {
    const v = archivo.respuestas[c.id];
    if (v == null || v === "" || (Array.isArray(v) && !v.length)) continue;
    lineas.push(`${c.etiqueta}: ${v === true ? "Sí" : v === false ? "No" : Array.isArray(v) ? v.join(", ") : String(v)}`);
  }
  return lineas.join("\n");
}
