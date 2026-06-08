import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import FormsInventario from "./Forms";

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

      <div className="overflow-hidden rounded-xl bg-white ring-1 ring-zinc-200">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3">Producto</th>
              <th className="px-4 py-3 text-right">Precio</th>
              <th className="px-4 py-3 text-right">Stock</th>
              <th className="px-4 py-3 text-right">Mínimo</th>
              <th className="px-4 py-3">COFEPRIS</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {conStock.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-400">
                  Aún no hay productos. Agrega el primero arriba.
                </td>
              </tr>
            )}
            {conStock.map((p) => (
              <tr key={p.id} className="hover:bg-zinc-50">
                <td className="px-4 py-3 font-medium text-zinc-900">
                  <Link href={`/inventario/${p.id}`} className="hover:underline">
                    {p.nombre}
                  </Link>
                  {p.es_controlado && (
                    <span className="ml-2 rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-purple-700">
                      controlado
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-zinc-700">
                  ${Number(p.precio_venta).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  <span
                    className={
                      p.bajo ? "font-semibold text-amber-700" : "text-zinc-900"
                    }
                  >
                    {p.stock}
                  </span>
                  {p.bajo && (
                    <span className="ml-1.5 text-xs text-amber-600">⚠</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-zinc-500">
                  {p.stock_minimo}
                </td>
                <td className="px-4 py-3 text-zinc-500">
                  {p.fraccion_cofepris === "na"
                    ? "—"
                    : `Fracción ${p.fraccion_cofepris}`}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/inventario/${p.id}`}
                    className="text-sm font-medium text-zinc-700 hover:text-zinc-900"
                  >
                    Editar →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
