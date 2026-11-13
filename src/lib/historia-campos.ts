// Reglas de captura de la historia clínica. Viven aquí porque las usan el
// formulario, la tarjeta de edición y la vista de impresión.

export type CampoHistoria = {
  id: string;
  etiqueta: string;
  tipo_dato: string;
  opciones: string[] | null;
  orden: number;
  requerido: boolean;
  seccion?: string | null;
  oculto?: boolean | null;
  depende_de?: string | null;
  depende_valor?: string | null;
  solo_sexo?: string | null;
  valor_default?: string | null;
  rol?: string | null;
};

export const NO_APLICA = "No aplica";
export const NEGADO = "Negado";

export function etiquetaHistoria(etiqueta: string): string {
  const claras: Record<string, string> = {
    "Cardiópatas": "Enfermedades del corazón",
    "Nefrópatas": "Enfermedades del riñón",
    "Menarca (edad)": "Inicio de la menstruación (edad)",
    "Medicamentos actuales": "¿Cuáles medicamentos toma y en qué dosis?",
  };
  return claras[etiqueta] ?? etiqueta;
}

// Cambia la captura sin renombrar IDs ni reescribir historias anteriores.
export function prepararCamposHistoria<T extends { etiqueta: string; tipo_dato?: string; opciones?: string[] | null; seccion?: string | null }>(campos: T[]): T[] {
  return campos.map((campo) => ({
    ...campo,
    etiqueta: etiquetaHistoria(campo.etiqueta),
    ...(campo.tipo_dato === "multi" && campo.seccion === "II. Antecedentes heredofamiliares"
      ? { opciones: [...new Set([...(campo.opciones ?? []), NEGADO])] } : {}),
  }));
}

export function elegirOpcionMultiple(actuales: string[], opcion: string, marcado: boolean): string[] {
  if (!marcado) return actuales.filter((v) => v !== opcion);
  if (opcion === NEGADO) return [NEGADO];
  return [...new Set([...actuales.filter((v) => v !== NEGADO), opcion])];
}

export function validarMultiplesHistoria(
  campos: { id: string; tipo_dato: string; opciones: string[] | null }[],
  datos: Record<string, unknown>,
  previos: Record<string, unknown> = {},
): string | null {
  for (const campo of campos) {
    const v = datos[campo.id];
    if (campo.tipo_dato !== "multi" || v == null || v === "") continue;
    // Las historias importadas ya traían texto libre; editar otra respuesta
    // debe conservarlo hasta que la persona decida sustituirlo.
    if (typeof v === "string" && v === previos[campo.id]) continue;
    if (Array.isArray(v) && !(v.includes(NEGADO) && v.length > 1) && JSON.stringify(v) === JSON.stringify(previos[campo.id])) continue;
    if (!Array.isArray(v) || v.some((x) => typeof x !== "string" || !(campo.opciones ?? []).includes(x))) return "Selecciona opciones válidas en los antecedentes familiares.";
    if (v.includes(NEGADO) && v.length > 1) return "Negado no puede combinarse con familiares.";
  }
  return null;
}

// `pacientes.sexo` guarda 'F' o 'M', pero los 548 pacientes importados traen
// texto suelto. Si no se reconoce, se prefiere preguntar de más a esconder algo.
export function sexoNormalizado(sexo: string | null | undefined): "F" | "M" | null {
  const inicial = (sexo ?? "").trim().charAt(0).toUpperCase();
  return inicial === "F" || inicial === "M" ? inicial : null;
}

export function aplicaPorSexo(campo: CampoHistoria, sexo: "F" | "M" | null): boolean {
  if (!campo.solo_sexo) return true;
  if (sexo === null) return true;
  return campo.solo_sexo === sexo;
}

// El hijo solo se pregunta cuando el padre ya tiene el valor que lo abre. Sin
// respuesta del padre queda cerrado, que es lo que pidió Fernanda.
export function dependenciaCumplida(
  campo: CampoHistoria,
  valores: Record<string, unknown>,
): boolean {
  if (!campo.depende_de) return true;
  const valorPadre = valores[campo.depende_de];
  if (valorPadre === undefined || valorPadre === null) return false;
  return String(valorPadre) === String(campo.depende_valor ?? "true");
}

export function campoVisible(
  campo: CampoHistoria,
  valores: Record<string, unknown>,
  sexo: "F" | "M" | null,
): boolean {
  if (campo.oculto) return false;
  if (!aplicaPorSexo(campo, sexo)) return false;
  return dependenciaCumplida(campo, valores);
}

function tieneRespuesta(v: unknown): boolean {
  return v != null && v !== "" && !(Array.isArray(v) && !v.length);
}

export function campoVisibleEnEdicion(campo: CampoHistoria, valores: Record<string, unknown>, sexo: "F" | "M" | null, previos: Record<string, unknown>): boolean {
  if (campoVisible(campo, valores, sexo)) return true;
  if (campo.oculto || !tieneRespuesta(previos[campo.id])) return false;
  if (!aplicaPorSexo(campo, sexo)) return true;
  return !!campo.depende_de && valores[campo.depende_de] == null;
}

export function valoresParaEditar(campos: CampoHistoria[], valores: Record<string, unknown>, previos: Record<string, unknown>): Record<string, unknown> {
  const salida = { ...valores };
  for (const campo of campos) {
    if (campo.oculto || !campo.depende_de) continue;
    // Un Sí/No antiguo ausente no elimina lo que la doctora ya escribió.
    // Solo una respuesta explícita que cierra el detalle lo retira al guardar.
    if (valores[campo.depende_de] != null && !dependenciaCumplida(campo, valores)) delete salida[campo.id];
    else if (!(campo.id in salida) && tieneRespuesta(previos[campo.id])) salida[campo.id] = previos[campo.id];
  }
  return salida;
}

function aNumero(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const numero = Number(String(valor).replace(",", "."));
  return Number.isFinite(numero) && numero > 0 ? numero : null;
}

// La doctora captura la talla en metros, pero alguien acabará escribiendo 165.
export function calcularImcHistoria(peso: unknown, talla: unknown): string {
  const kg = aNumero(peso);
  const bruto = aNumero(talla);
  if (kg === null || bruto === null || kg >= 500) return "";
  const metros = bruto > 3 ? bruto / 100 : bruto;
  if (metros < 0.5 || metros > 2.5) return "";
  return (kg / (metros * metros)).toFixed(1);
}

// Deja el paquete listo para guardar: quita lo que se cerró al cambiar una
// respuesta y marca "No aplica" en lo que no corresponde al sexo del paciente.
export function valoresParaGuardar(
  campos: CampoHistoria[],
  valores: Record<string, unknown>,
  sexo: "F" | "M" | null,
): Record<string, unknown> {
  const salida: Record<string, unknown> = { ...valores };
  for (const campo of campos) {
    if (campo.oculto) continue;
    if (!aplicaPorSexo(campo, sexo)) {
      salida[campo.id] = NO_APLICA;
      continue;
    }
    if (!dependenciaCumplida(campo, valores)) delete salida[campo.id];
  }
  return salida;
}
