// Plantillas de receta por fase: las combinaciones que la doctora ya tenía
// armadas en PDF y que Fernanda copiaba y pegaba a mano.

export type ItemPlantilla = {
  medicamento: string;
  dosis: string;
  duracion_dias: number | null;
  indicaciones: string;
};

export type PlantillaReceta = {
  id: string;
  categoria: string;
  nombre: string;
  fases: number[];
  fase_texto: string | null;
  items: ItemPlantilla[];
};

// Orden en el que se muestran las pestañas. Cualquier categoría que no esté
// aquí se acomoda al final, para que agregar una carpeta nueva no la esconda.
const ORDEN = ["FASE 1", "FASE 2", "FASE 3 y 4", "FASE 5", "Mantenimiento", "RETOMAR"];

export function categoriasDe(plantillas: PlantillaReceta[]): string[] {
  const vistas = [...new Set(plantillas.map((p) => p.categoria))];
  return vistas.sort((a, b) => {
    const ia = ORDEN.indexOf(a);
    const ib = ORDEN.indexOf(b);
    return (ia === -1 ? ORDEN.length : ia) - (ib === -1 ? ORDEN.length : ib) || a.localeCompare(b, "es");
  });
}

// Varias hojas traen impresa una fase distinta a la de su carpeta, y de forma
// sistemática: las de "FASE 2" dicen FASE 3. Mientras el consultorio no decida
// cuál manda, la pantalla lo señala en vez de elegir por su cuenta.
export function faseDeEtiqueta(faseTexto: string | null): number | null {
  if (!faseTexto) return null;
  const m = faseTexto.match(/^\s*FASE\s+(\d+)/i);
  return m ? Number(m[1]) : null;
}

export function etiquetaDiscrepa(plantilla: PlantillaReceta): boolean {
  const impresa = faseDeEtiqueta(plantilla.fase_texto);
  if (impresa === null || plantilla.fases.length === 0) return false;
  return !plantilla.fases.includes(impresa);
}
