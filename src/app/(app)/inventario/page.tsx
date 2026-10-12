import { createClient } from "@/lib/supabase/server";
import FormsInventario from "./Forms";
import TablaProductos from "./TablaProductos";
import Link from 'next/link';
import { stockPanel, claveAvisoInventario, AVISOS_INVENTARIO } from '@/lib/panel-operativo';

type Lote = { cantidad_actual: number; caducidad: string | null };
type Producto = {
  id: string;
  nombre: string;
  precio_venta: number;
  stock_minimo: number;
  es_controlado: boolean;
  fraccion_cofepris: string;
  es_historico: boolean | null;
  codigo_barras: string | null;
  activo: boolean;
  lotes: Lote[];
};

export default async function InventarioPage({ searchParams }: { searchParams: Promise<{ aviso?: string }> }) {
  const aviso = claveAvisoInventario((await searchParams).aviso);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("productos")
    .select(
      "id, nombre, precio_venta, stock_minimo, es_controlado, fraccion_cofepris, es_historico, codigo_barras, activo, lotes(cantidad_actual, caducidad)",
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
  const ahora = new Date();
  const mostrados = aviso ? conStock.filter(p => p.activo && stockPanel([p], ahora)[aviso] > 0) : conStock;

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

      {aviso && <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-300 bg-white p-3 text-sm text-zinc-800"><p>{AVISOS_INVENTARIO[aviso]}: {mostrados.length} productos. Abre un producto para revisar sus lotes.</p><Link href="/inventario" className="min-h-11 content-center font-semibold underline">Ver todo el inventario</Link></div>}

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          Error al cargar: {error.message}
        </p>
      )}

      <TablaProductos
        key={aviso ?? 'todos'}
        productos={mostrados.map((p) => ({
          id: p.id,
          nombre: p.nombre,
          precio_venta: p.precio_venta,
          stock: p.stock,
          stock_minimo: p.stock_minimo,
          bajo: p.bajo,
          es_controlado: p.es_controlado,
          fraccion_cofepris: p.fraccion_cofepris,
          es_historico: p.es_historico,
        }))}
      />
    </div>
  );
}
