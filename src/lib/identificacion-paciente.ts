export const BUCKET_IDENTIFICACIONES = "identificaciones-pacientes";
export const MAX_IDENTIFICACION_BYTES = 4 * 1024 * 1024;
export const TIPOS_IDENTIFICACION = { frente: "Identificación, frente", reverso: "Identificación, reverso", tutor: "Identificación de tutor", otra: "Otra identificación" } as const;
export type TipoIdentificacion = keyof typeof TIPOS_IDENTIFICACION;

export function puedeGestionarIdentificacion(rol: unknown): boolean {
  return typeof rol === "string" && ["admin", "doctora", "asistente", "gerente"].includes(rol);
}
export function idPacienteValido(id: unknown): id is string {
  return typeof id === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id);
}
export function nombreIdentificacionValido(nombre: unknown): nombre is string {
  return typeof nombre === "string" && /^(frente|reverso|tutor|otra)-[a-f0-9-]{36}\.(jpg|png|webp|pdf)$/.test(nombre);
}
export function validarIdentificacion(nombre: string, mime: string, bytes: Uint8Array): { extension: string; mime: string } {
  if (!bytes.length || bytes.length > MAX_IDENTIFICACION_BYTES) throw new Error("El archivo debe pesar entre 1 byte y 4 MB.");
  const inicia = (...valores: number[]) => valores.every((v,i) => bytes[i] === v);
  const texto = (a: number, b: number) => new TextDecoder('latin1').decode(bytes.subarray(a,b));
  let tipo: { extension: string; mime: string } | null = null;
  if (bytes.length > 20 && inicia(0xff,0xd8,0xff) && bytes[bytes.length-2] === 0xff && bytes[bytes.length-1] === 0xd9) tipo = { extension: "jpg", mime: "image/jpeg" };
  else if (bytes.length > 45 && inicia(137,80,78,71,13,10,26,10) && texto(12,16) === 'IHDR' && texto(bytes.length-8,bytes.length-4) === 'IEND') tipo = { extension: "png", mime: "image/png" };
  else if (bytes.length > 20 && texto(0,4) === 'RIFF' && texto(8,12) === 'WEBP' && new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(4,true) === bytes.length-8) tipo = { extension: "webp", mime: "image/webp" };
  else if (bytes.length > 30 && texto(0,5) === '%PDF-' && /%%EOF\s*$/.test(texto(Math.max(0,bytes.length-1024),bytes.length))) tipo = { extension: "pdf", mime: "application/pdf" };
  if (!tipo) throw new Error("Usa una foto JPG, PNG o WebP, o un PDF completo.");
  const extension = nombre.split('.').at(-1)?.toLowerCase();
  if (!(tipo.extension === "jpg" ? ["jpg", "jpeg"] : [tipo.extension]).includes(extension ?? "") || (mime && mime !== tipo.mime && mime !== "application/octet-stream")) throw new Error("El contenido del archivo no coincide con su extensión o formato.");
  return tipo;
}
