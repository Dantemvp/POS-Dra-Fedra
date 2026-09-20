"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BadgeHistorico,
  SelectorHistorico,
  coincideVista,
  textoBusqueda,
  type VistaHistorico,
} from "@/components/Historico";

export type ProductoFila = {
  id: string;
  nombre: string;
  precio_venta: number;
  stock: number;
  stock_minimo: number;
  bajo: boolean;
  es_controlado: boolean;
  fraccion_cofepris: string;
  es_historico?: boolean | null;
};

export default function TablaProductos({
  productos,
}: {
  productos: ProductoFila[];
}) {
  const [q, setQ] = useState("");
  const [vista, setVista] = useState<VistaHistorico>("todos");
  const [stock, setStock] = useState<"todos" | "disponible" | "bajo" | "agotado">("todos");
  const [tipo, setTipo] = useState<"todos" | "controlado" | "libre">("todos");
  const [fraccion, setFraccion] = useState("todas");

  const filtrados = useMemo(() => {
    const s = q.trim().toLowerCase();
    return productos.filter(
      (p) =>
        (!s ||
          `${p.nombre}${textoBusqueda(p.es_historico)}`.toLowerCase().includes(s)) &&
        coincideVista(p.es_historico, vista) &&
        (stock === "todos" ||
          (stock === "disponible" && p.stock > 0) ||
          (stock === "bajo" && p.bajo) ||
          (stock === "agotado" && p.stock <= 0)) &&
        (tipo === "todos" ||
          (tipo === "controlado" && p.es_controlado) ||
          (tipo === "libre" && !p.es_controlado)) &&
        (fraccion === "todas" || p.fraccion_cofepris === fraccion),
    );
  }, [q, vista, stock, tipo, fraccion, productos]);

  const hayFiltros = q || vista !== "todos" || stock !== "todos" || tipo !== "todos" || fraccion !== "todas";

  function limpiar() {
    setQ("");
    setVista("todos");
    setStock("todos");
    setTipo("todos");
    setFraccion("todas");
  }

  return (
    <div>
      <div className="mb-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-zinc-200">
        <div className="flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar producto por nombre para revisar o editar…"
          className="min-w-[16rem] flex-[2] rounded-xl border border-zinc-300 px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-[#3f5148] focus:ring-2 focus:ring-[#3f5148]/10"
        />
        <SelectorHistorico valor={vista} onChange={setVista} />
        <select aria-label="Filtrar por existencia" value={stock} onChange={(e) => setStock(e.target.value as typeof stock)} className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700">
          <option value="todos">Todo el stock</option>
          <option value="disponible">Con existencia</option>
          <option value="bajo">Stock bajo</option>
          <option value="agotado">Agotados</option>
        </select>
        <select aria-label="Filtrar por tipo de producto" value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700">
          <option value="todos">Todos los tipos</option>
          <option value="controlado">Controlados</option>
          <option value="libre">No controlados</option>
        </select>
        <select aria-label="Filtrar por fracción COFEPRIS" value={fraccion} onChange={(e) => setFraccion(e.target.value)} className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700">
          <option value="todas">Toda COFEPRIS</option>
          <option value="na">No aplica</option>
          {['I','II','III','IV','V','VI'].map((f) => <option key={f} value={f}>Fracción {f}</option>)}
        </select>
        </div>
        <div className="mt-2 flex items-center justify-between px-1 text-xs text-zinc-500">
          <span>{filtrados.length} de {productos.length} productos</span>
          {hayFiltros && <button type="button" onClick={limpiar} className="font-medium text-[#3f5148] hover:underline">Limpiar filtros</button>}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-zinc-200">
        <table className="min-w-[760px] w-full text-left text-sm">
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
                    : "Ningún producto coincide con los filtros."}
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
                  {p.es_historico && (
                    <span className="ml-2 inline-block align-middle">
                      <BadgeHistorico compacto />
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
