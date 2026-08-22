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
