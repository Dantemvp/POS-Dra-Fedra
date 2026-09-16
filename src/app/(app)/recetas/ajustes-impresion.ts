// Constantes y tipos de los ajustes de impresión de la receta. Viven fuera de
// `actions.ts` porque ese módulo lleva "use server" y ahí solo pueden salir
// funciones async.

// Valores que se escriben junto a las etiquetas ya impresas del recetario
// (PESO, ESTATURA, IMC, PESO MÁXIMO IDEAL, PESO SUGERIDO, CINTURA). Se guardan
// como texto porque en el papel conviven "78", "78.4 kg" y "1.65 m".
export const CLAVES_METRICAS = [
  "peso",
  "estatura",
  "imc",
  "peso_ideal",
  "peso_sugerido",
  "cintura",
] as const;

export type ClaveMetricaReceta = (typeof CLAVES_METRICAS)[number];
export type MetricasReceta = Record<ClaveMetricaReceta, string>;

// 40 caracteres es lo más que cabe en la insignia sin que su borde izquierdo
// alcance la columna de medicamentos.
export const MAX_TEXTO_FASE = 40;
export const MAX_TEXTO_METRICA = 24;

export type AjustesImpresionReceta = {
  tamano: number;
  separacion: number;
  izquierda: number;
  inicio: number;
  mostrar_metricas: boolean;
  // Lo que se imprime en la insignia de fase. La columna `fase` sigue siendo el
  // número, del que dependen los filtros y las gráficas.
  fase_texto: string;
  metricas: MetricasReceta;
};

export function metricasVacias(): MetricasReceta {
  return {
    peso: "",
    estatura: "",
    imc: "",
    peso_ideal: "",
    peso_sugerido: "",
    cintura: "",
  };
}

// La RPC guarda `p_ajustes` tal cual, así que el texto libre se recorta y se
// normaliza antes de que llegue a la base.
export function limpiarAjustes(ajustes: AjustesImpresionReceta): AjustesImpresionReceta {
  const metricas = metricasVacias();
  for (const clave of CLAVES_METRICAS) {
    metricas[clave] = String(ajustes.metricas?.[clave] ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_TEXTO_METRICA);
  }
  return {
    tamano: ajustes.tamano,
    separacion: ajustes.separacion,
    izquierda: ajustes.izquierda,
    inicio: ajustes.inicio,
    mostrar_metricas: ajustes.mostrar_metricas,
    fase_texto: String(ajustes.fase_texto ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_TEXTO_FASE),
    metricas,
  };
}
