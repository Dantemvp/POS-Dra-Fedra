// Solo abrevia la presentación del envase. No deduce sustancias, dosis ni días.
export function nombreParaReceta(nombre: string): string {
  let breve = nombre
    .replace(/\b(?:caja\s+(?:con|de)\s+|con\s+|c\s*\/\s*)\d+\s*(c[aá]psulas?|tabletas?|comprimidos?)\b/gi, "$1")
    .replace(/\b(c[aá]psulas?|tabletas?|comprimidos?)\s*\(\s*\d+\s*\)/gi, "$1")
    .replace(/\bde\s+\d+\s+(c[aá]psulas?|tabletas?|comprimidos?)\b/gi, "$1")
    .replace(/\(\s*\)/g, "")
    .replace(/\s+/g, " ").trim();
  // Separa la marca únicamente cuando la sustancia ya está escrita.
  const partes = breve.match(/^([^()]+?)\s+(fentermina|amfepramona)\b(.+)$/i);
  if (partes) breve = `${partes[1]} (${partes[2]}${partes[3]})`;
  return breve;
}

export function productosParaReceta(productos: { id: string; nombre: string }[]) {
  const nombres = productos.map((p) => ({ ...p, breve: nombreParaReceta(p.nombre) }));
  // Si dos envases se abrevian igual, conserva el nombre completo para que la
  // farmacia no reciba un producto distinto al que eligió la doctora.
  return nombres.map((p) => ({ id: p.id, nombre: nombres.filter((otro) => otro.breve.toLowerCase() === p.breve.toLowerCase()).length === 1 ? p.breve : p.nombre }));
}
