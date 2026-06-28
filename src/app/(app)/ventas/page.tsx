import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth";
import POS from "./pos";

type Lote = { cantidad_actual: number };
type ProductoRow = {
  id: string;
  nombre: string;
  precio_venta: number;
  requiere_receta: boolean;
  codigo_barras: string | null;
  lotes: Lote[];
};

export default async function VentasPage() {
  const supabase = await createClient();
  const usuario = await getUsuarioActual();
  const { data } = await supabase
    .from("productos")
    .select(
      "id, nombre, precio_venta, requiere_receta, codigo_barras, lotes(cantidad_actual)",
    )
    .eq("activo", true)
    .order("nombre");

  const productos = ((data ?? []) as ProductoRow[]).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    precio: Number(p.precio_venta),
    requiere_receta: p.requiere_receta,
    codigo_barras: p.codigo_barras,
    stock: (p.lotes ?? []).reduce((s, l) => s + Number(l.cantidad_actual ?? 0), 0),
  }));

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-1 text-2xl font-semibold text-zinc-900">Punto de venta</h1>
      <p className="mb-6 text-sm text-zinc-500">
        Busca productos, arma el carrito y cobra.
      </p>
      <POS productos={productos} vendedor={usuario?.nombre ?? ""} />
    </div>
  );
}
