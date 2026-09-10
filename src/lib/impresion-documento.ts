export function contenidoCabeEnArea({
  contenidoInferior,
  limiteSuperior,
  tolerancia = 1,
}: {
  contenidoInferior: number;
  limiteSuperior: number;
  tolerancia?: number;
}): boolean {
  if (![contenidoInferior, limiteSuperior, tolerancia].every(Number.isFinite) || tolerancia < 0) return false;
  return contenidoInferior <= limiteSuperior + tolerancia;
}
