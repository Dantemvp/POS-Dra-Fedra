/** Cantidad y precio admiten dos decimales, como las columnas de cobro_items. */
export function subtotalCobro(cantidad: number, precio: number): number {
  const cantidadCentesimas = Math.round(cantidad * 100);
  const precioCentavos = Math.round(precio * 100);
  return Math.round(cantidadCentesimas * precioCentavos / 100) / 100;
}

export function totalCobro(items: { cantidad: number; precio_unit: number }[]): number {
  return items.reduce((s, i) => s + Math.round(subtotalCobro(i.cantidad, i.precio_unit) * 100), 0) / 100;
}
