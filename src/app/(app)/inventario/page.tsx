import { createClient } from "@/lib/supabase/server";
import FormsInventario from "./Forms";
import TablaProductos from "./TablaProductos";

type Lote = { cantidad_actual: number; caducidad: string | null };
type Producto = {
  id: string;
  nombre: string;
  precio_venta: number;
  stock_minimo: number;
  es_controlado: boolean;
  fraccion_cofepris: string;
  lotes: Lote[];
};

export default async function InventarioPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("productos")
    .select(
      "id, nombre, precio_venta, stock_minimo, es_controlado, fraccion_cofepris, lotes(cantidad_actual, caducidad)",
    )
    .order("nombre");

  const productos = (data ?? []) as Producto[];

  const conStock = productos.map((p) => {
    const stock = (p.lotes ?? []).reduce(
      (s, l) => s + Number(l.cantidad_actual ?? 0),
      0,
    );
    const min = Number(p.stock_minimo ?? 0);
    return { ...p, stock, bajo: min > 0 && stock <= min };
  });

  const alertas = conStock.filter((p) => p.bajo).length;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Inventario</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {conStock.length} productos
            {alertas > 0 && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                {alertas} con stock bajo
              </span>
            )}
          </p>
        </div>
      </div>

      <FormsInventario
        productos={conStock.map((p) => ({ id: p.id, nombre: p.nombre }))}
      />

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          Error al cargar: {error.message}
        </p>
      )}

      <TablaProductos
        productos={conStock.map((p) => ({
          id: p.id,
          nombre: p.nombre,
          precio_venta: p.precio_venta,
          stock: p.stock,
          stock_minimo: p.stock_minimo,
          bajo: p.bajo,
          es_controlado: p.es_controlado,
          fraccion_cofepris: p.fraccion_cofepris,
        }))}
      />
    </div>
  );
}
