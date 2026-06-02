import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Archivos, { type ArchivoVista } from "./Archivos";
import EditarProducto from "./EditarProducto";

type Producto = {
  id: string;
  nombre: string;
  precio_venta: number;
  stock_minimo: number;
  es_controlado: boolean;
  requiere_receta: boolean;
  fraccion_cofepris: string;
  codigo_barras: string | null;
  lotes: { cantidad_actual: number }[];
};
type Archivo = {
  id: string;
  nombre: string | null;
  tipo: string | null;
  path: string;
  creado_en: string;
};

export default async function ProductoDetalle({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("productos")
    .select(
      "id, nombre, precio_venta, stock_minimo, es_controlado, requiere_receta, fraccion_cofepris, codigo_barras, lotes(cantidad_actual)",
    )
    .eq("id", id)
    .single();

  if (!data) notFound();
  const p = data as Producto;
  const stock = (p.lotes ?? []).reduce(
    (s, l) => s + Number(l.cantidad_actual ?? 0),
    0,
  );

  const { data: archData } = await supabase
    .from("producto_archivos")
    .select("id, nombre, tipo, path, creado_en")
    .eq("producto_id", id)
    .order("creado_en", { ascending: false });

  // URLs firmadas para ver/descargar (bucket privado)
  const archivos: ArchivoVista[] = [];
  for (const a of (archData ?? []) as Archivo[]) {
    const { data: signed } = await supabase.storage
      .from("archivos")
      .createSignedUrl(a.path, 3600);
    archivos.push({
      id: a.id,
      nombre: a.nombre ?? "archivo",
      tipo: a.tipo ?? "otro",
      path: a.path,
      url: signed?.signedUrl ?? "",
    });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/inventario" className="text-sm text-zinc-500 hover:text-zinc-900">
        ← Inventario
      </Link>

      <div className="mt-2 mb-6 rounded-xl bg-white p-5 ring-1 ring-zinc-200">
        <div className="flex items-start justify-between">
          <h1 className="text-2xl font-semibold text-zinc-900">
            {p.nombre}
            {p.es_controlado && (
              <span className="ml-2 rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-purple-700">
                controlado
              </span>
            )}
          </h1>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-zinc-600">
          <span>Precio: ${Number(p.precio_venta).toFixed(2)}</span>
          <span>Stock: {stock}</span>
          <span>Mínimo: {p.stock_minimo}</span>
          {p.fraccion_cofepris !== "na" && (
            <span>Fracción {p.fraccion_cofepris}</span>
          )}
        </div>
      </div>

      <div className="mb-6">
        <EditarProducto
          producto={{
            id: p.id,
            nombre: p.nombre,
            precio_venta: Number(p.precio_venta),
            stock_minimo: Number(p.stock_minimo),
            es_controlado: p.es_controlado,
            requiere_receta: p.requiere_receta,
            fraccion_cofepris: p.fraccion_cofepris,
            codigo_barras: p.codigo_barras,
          }}
        />
      </div>

      <Archivos productoId={p.id} archivos={archivos} />
    </div>
  );
}
