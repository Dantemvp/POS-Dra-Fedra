export type LimitesVerticales = {
  contenidoInferior: number;
  limiteSuperior: number;
  tolerancia?: number;
};

export function contenidoCabeEnArea({
  contenidoInferior,
  limiteSuperior,
  tolerancia = 1,
}: LimitesVerticales): boolean {
  if (
    !Number.isFinite(contenidoInferior) ||
    !Number.isFinite(limiteSuperior) ||
    !Number.isFinite(tolerancia) ||
    tolerancia < 0
  ) {
    return false;
  }

  return contenidoInferior <= limiteSuperior + tolerancia;
}

function partesFecha(valor: string): [number, number, number] | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor);
  if (!match) return null;
  const partes = [Number(match[1]), Number(match[2]), Number(match[3])] as const;
  const [anio, mes, dia] = partes;
  if (
    mes < 1 ||
    mes > 12 ||
    dia < 1 ||
    dia > new Date(Date.UTC(anio, mes, 0)).getUTCDate()
  ) {
    return null;
  }
  return [anio, mes, dia];
}

export function edadEnFecha(
  fechaNacimiento?: string | null,
  fechaReferencia?: string | null,
): string {
  if (!fechaNacimiento || !fechaReferencia) return "";
  const nacimiento = partesFecha(fechaNacimiento);
  const referencia = partesFecha(fechaReferencia);
  if (!nacimiento || !referencia) return "";

  const [anioN, mesN, diaN] = nacimiento;
  const [anioR, mesR, diaR] = referencia;
  if (
    anioR < anioN ||
    (anioR === anioN && (mesR < mesN || (mesR === mesN && diaR < diaN)))
  ) {
    return "";
  }

  let edad = anioR - anioN;
  if (mesR < mesN || (mesR === mesN && diaR < diaN)) edad--;
  return String(edad);
}
