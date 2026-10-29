const normalizar = (texto: string) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export function indexarCatalogo<T extends { id: string; nombre: string; codigo_barras: string | null }>(productos: T[]) {
  const codigos = new Map<string, T>();
  const ids = new Map<string, T>();
  const nombres = productos.map(producto => {
    // Conserva la primera coincidencia del catálogo, igual que find().
    if (producto.codigo_barras && !codigos.has(producto.codigo_barras)) codigos.set(producto.codigo_barras, producto);
    ids.set(producto.id, producto);
    return { producto, texto: normalizar(producto.nombre) };
  });
  return { codigos, ids, nombres };
}

export function buscarCatalogo<T>(indice: { nombres: { producto: T; texto: string }[] }, consulta: string) {
  const q = normalizar(consulta);
  if (!q) return [];
  const resultados: T[] = [];
  for (const fila of indice.nombres) {
    if (fila.texto.includes(q)) resultados.push(fila.producto);
    if (resultados.length === 6) break;
  }
  return resultados;
}
