export const COBRO_BORRADOR_KEY = "fedra:cobro-borrador:v1";

export type MetodoCobro = "efectivo" | "tarjeta" | "transferencia" | "otro";

export type ItemCobroBorrador = {
  tipo: "servicio" | "producto";
  servicio_id: string | null;
  producto_id: string | null;
  descripcion: string;
  cantidad: number;
  precio_unit: number;
};

export type CobroBorrador = {
  version: 1;
  paciente_id: string;
  items: ItemCobroBorrador[];
  metodo: MetodoCobro;
  nota: string;
};

const METODOS = new Set<MetodoCobro>([
  "efectivo",
  "tarjeta",
  "transferencia",
  "otro",
]);

export function leerCobroBorrador(raw: string | null): CobroBorrador | null {
  if (!raw) return null;
  try {
    const valor = JSON.parse(raw) as Partial<CobroBorrador>;
    if (valor.version !== 1 || !METODOS.has(valor.metodo as MetodoCobro)) return null;
    if (typeof valor.paciente_id !== "string" || typeof valor.nota !== "string") return null;
    if (!Array.isArray(valor.items) || valor.items.length > 100) return null;

    const items: ItemCobroBorrador[] = [];
    for (const item of valor.items) {
      if (!item || (item.tipo !== "servicio" && item.tipo !== "producto")) return null;
      if (typeof item.descripcion !== "string" || item.descripcion.length > 300) return null;
      if (!Number.isFinite(item.cantidad) || item.cantidad < 1) return null;
      if (!Number.isFinite(item.precio_unit) || item.precio_unit < 0) return null;
      items.push({
        tipo: item.tipo,
        servicio_id: typeof item.servicio_id === "string" ? item.servicio_id : null,
        producto_id: typeof item.producto_id === "string" ? item.producto_id : null,
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        precio_unit: item.precio_unit,
      });
    }

    return {
      version: 1,
      paciente_id: valor.paciente_id,
      items,
      metodo: valor.metodo as MetodoCobro,
      nota: valor.nota.slice(0, 1000),
    };
  } catch {
    return null;
  }
}

export function tieneContenidoCobro(borrador: CobroBorrador) {
  return Boolean(borrador.paciente_id || borrador.items.length || borrador.nota.trim());
}
