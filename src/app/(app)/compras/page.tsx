import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth";
import NuevaCompra from "./NuevaCompra";
import EliminarCompra from "./EliminarCompra";

const money = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

type Compra = {
  id: string;
  factura: string | null;
  fecha: string;
  total: number | null;
  proveedores: { nombre: string } | null;
};

export default async function ComprasPage() {
  const supabase = await createClient();
  const usuario = await getUsuarioActual();
  const esAdmin = usuario?.rol === "admin";

  const { data: productosData } = await supabase
    .from("productos")
    .select("id, nombre, codigo_barras")
    .eq("activo", true)
    .order("nombre");
  const productos = (productosData ?? []) as {
    id: string;
    nombre: string;
    codigo_barras: string | null;
  }[];

  const { data: comprasData } = await supabase
    .from("compras")
    .select("id, factura, fecha, total, proveedores(nombre)")
    .order("fecha", { ascending: false })
    .limit(30);
  const compras = (comprasData ?? []) as unknown as Compra[];

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-1 text-2xl font-semibold text-zinc-900">Compras</h1>
      <p className="mb-6 text-sm text-zinc-500">
        Registra lo que compras a proveedores; suma al inventario.
      </p>

      <NuevaCompra productos={productos} />

      <div className="overflow-hidden rounded-xl bg-white ring-1 ring-zinc-200">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Proveedor</th>
              <th className="px-4 py-3">Factura</th>
              <th className="px-4 py-3 text-right">Total</th>
              {esAdmin && <th className="px-4 py-3"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {compras.length === 0 && (
              <tr>
                <td colSpan={esAdmin ? 5 : 4} className="px-4 py-8 text-center text-zinc-400">
                  Sin compras registradas.
                </td>
              </tr>
            )}
            {compras.map((c) => (
              <tr key={c.id} className="hover:bg-zinc-50">
                <td className="px-4 py-3 text-zinc-700">
                  {new Date(c.fecha).toLocaleDateString("es-MX")}
                </td>
                <td className="px-4 py-3 text-zinc-700">
                  {c.proveedores?.nombre ?? "—"}
                </td>
                <td className="px-4 py-3 text-zinc-600">{c.factura ?? "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums text-zinc-900">
                  {c.total != null ? money(Number(c.total)) : "—"}
                </td>
                {esAdmin && (
                  <td className="px-4 py-3 text-right">
                    <EliminarCompra id={c.id} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
