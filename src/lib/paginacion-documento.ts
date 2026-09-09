export type RangoProtegido = {
  inicio: number;
  fin: number;
};

export type SegmentoPagina = {
  inicio: number;
  alto: number;
};

function numeroPositivo(valor: number, nombre: string): void {
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new Error(`${nombre} debe ser un número positivo.`);
  }
}

/**
 * Divide una captura vertical en páginas. Cuando un corte cae dentro de un
 * bloque protegido, adelanta el corte al inicio de ese bloque. Si el propio
 * bloque es más alto que una página, permite cortarlo para garantizar avance.
 */
export function planificarPaginas(
  altoTotal: number,
  altoMaximo: number,
  rangos: RangoProtegido[] = [],
): SegmentoPagina[] {
  numeroPositivo(altoTotal, "altoTotal");
  numeroPositivo(altoMaximo, "altoMaximo");

  const protegidos = rangos
    .filter(({ inicio, fin }) => Number.isFinite(inicio) && Number.isFinite(fin))
    .map(({ inicio, fin }) => ({
      inicio: Math.max(0, Math.min(altoTotal, inicio)),
      fin: Math.max(0, Math.min(altoTotal, fin)),
    }))
    .filter(({ inicio, fin }) => fin > inicio && fin - inicio <= altoMaximo)
    .sort((a, b) => a.inicio - b.inicio || a.fin - b.fin);

  const paginas: SegmentoPagina[] = [];
  let inicioPagina = 0;

  while (inicioPagina < altoTotal) {
    const limite = Math.min(inicioPagina + altoMaximo, altoTotal);
    if (limite === altoTotal) {
      paginas.push({ inicio: inicioPagina, alto: altoTotal - inicioPagina });
      break;
    }

    const atravesados = protegidos.filter(
      (rango) => rango.inicio < limite && rango.fin > limite,
    );
    const corteSeguro = atravesados
      .map((rango) => rango.inicio)
      .filter((inicio) => inicio > inicioPagina)
      .sort((a, b) => a - b)[0];
    const finPagina = corteSeguro ?? limite;

    paginas.push({ inicio: inicioPagina, alto: finPagina - inicioPagina });
    inicioPagina = finPagina;
  }

  return paginas;
}
