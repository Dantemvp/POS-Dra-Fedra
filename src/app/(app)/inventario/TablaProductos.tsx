"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export type ProductoFila = {
  id: string;
  nombre: string;
  precio_venta: number;
  stock: number;
  stock_minimo: number;
  bajo: boolean;
  es_controlado: boolean;
  fraccion_cofepris: string;
};

export default function TablaProductos({
  productos,
}: {
  productos: ProductoFila[];
}) {
  const [q, setQ] = useState("");

  const filtrados = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return productos;
    return productos.filter((p) => p.nombre.toLowerCase().includes(s));
  }, [q, productos]);

  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar producto por nombre para revisar o editar…"
        className="mb-3 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900"
      />

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
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-400">
                  {productos.length === 0
                    ? "Aún no hay productos. Agrega el primero arriba."
                    : `Sin coincidencias para "${q}".`}
                </td>
              </tr>
            )}
            {filtrados.map((p) => (
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
                  {p.bajo && <span className="ml-1.5 text-xs text-amber-600">⚠</span>}
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
