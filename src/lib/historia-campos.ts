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
