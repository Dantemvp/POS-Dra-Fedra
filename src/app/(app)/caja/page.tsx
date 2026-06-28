import { createClient } from "@/lib/supabase/server";
import { inicioDiaSinaloa, horaSinaloa } from "@/lib/tz";
import CorteButton from "./CorteButton";
import ExportLibro, { type FilaLibro } from "./ExportLibro";
import VentasDelDia, { type VentaDetalle } from "./VentasDelDia";

const money = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

type VentaRow = {
  id: string;
  folio: number;
  fecha: string;
  total: number;
  metodo_pago: string | null;
  venta_items: {
    cantidad: number;
    precio_unit: number;
    productos: { nombre: string } | null;
  }[];
  pagos: { metodo: string; monto: number }[];
};
type Mov = {
  tipo: string;
  cantidad: number;
  productos: { nombre: string; fraccion_cofepris: string; es_controlado: boolean } | null;
};

export default async function CajaPage() {
  const supabase = await createClient();

  // Inicio del día EN SINALOA (no en UTC del servidor) para el corte correcto.
  const desde = inicioDiaSinaloa().toISOString();

  const { data: ventasData } = await supabase
    .from("ventas")
    .select(
      "id, folio, fecha, total, metodo_pago, venta_items(cantidad, precio_unit, productos(nombre)), pagos(metodo, monto)",
    )
    .gte("fecha", desde)
    .eq("estado", "pagada")
    .order("fecha", { ascending: false });

  const ventas = (ventasData ?? []) as unknown as VentaRow[];
  const totalDia = ventas.reduce((s, v) => s + Number(v.total), 0);
  const porMetodo = ventas.reduce<Record<string, number>>((acc, v) => {
    const m = v.metodo_pago ?? "otro";
    acc[m] = (acc[m] ?? 0) + Number(v.total);
    return acc;
  }, {});
  const efectivo = porMetodo["efectivo"] ?? 0;

  const ventasDetalle: VentaDetalle[] = ventas.map((v) => ({
    id: v.id,
    folio: v.folio,
    hora: horaSinaloa(v.fecha),
    total: Number(v.total),
    metodo_pago: v.metodo_pago,
    items: (v.venta_items ?? []).map((it) => ({
      nombre: it.productos?.nombre ?? "—",
      cantidad: Number(it.cantidad),
      precio_unit: Number(it.precio_unit),
    })),
    pagos: (v.pagos ?? []).map((p) => ({
      metodo: p.metodo,
      monto: Number(p.monto),
    })),
  }));

  // Libro de Control COFEPRIS: movimientos de productos controlados
  const { data: movData } = await supabase
    .from("movimientos_inv")
    .select("tipo, cantidad, productos!inner(nombre, fraccion_cofepris, es_controlado)")
    .eq("productos.es_controlado", true);

  const movs = (movData ?? []) as unknown as Mov[];
  const libroMap = new Map<string, FilaLibro>();
  for (const m of movs) {
    const nombre = m.productos?.nombre ?? "—";
    const fr = m.productos?.fraccion_cofepris ?? "na";
    const key = nombre;
    const fila = libroMap.get(key) ?? {
      producto: nombre,
      fraccion: fr,
      entradas: 0,
      salidas: 0,
      existencia: 0,
    };
    if (m.tipo === "entrada") fila.entradas += Number(m.cantidad);
    else if (m.tipo === "salida" || m.tipo === "merma")
      fila.salidas += Number(m.cantidad);
    libroMap.set(key, fila);
  }
  const libro = Array.from(libroMap.values()).map((f) => ({
    ...f,
    existencia: f.entradas - f.salidas,
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Resumen del día */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-zinc-900">
            Caja y reportes
          </h1>
          <CorteButton totalVentas={totalDia} totalEfectivo={efectivo} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Card label="Ventas de hoy" value={String(ventas.length)} />
          <Card label="Total del día" value={money(totalDia)} />
          <Card label="Efectivo" value={money(efectivo)} />
          <Card
            label="Otros métodos"
            value={money(totalDia - efectivo)}
          />
        </div>
      </section>

      {/* Ventas recientes */}
      <section>
        <h2 className="mb-3 text-lg font-medium text-zinc-900">
          Ventas de hoy
        </h2>
        <p className="mb-3 text-xs text-zinc-500">
          Toca el folio para ver el desglose de productos y el pago.
        </p>
        <VentasDelDia ventas={ventasDetalle} />
      </section>

      {/* Libro de Control COFEPRIS */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium text-zinc-900">
              Libro de Control (COFEPRIS)
            </h2>
            <p className="text-xs text-zinc-500">
              Medicamentos controlados — existencia = entradas − salidas
            </p>
          </div>
          {libro.length > 0 && <ExportLibro filas={libro} />}
        </div>
        <div className="overflow-hidden rounded-xl bg-white ring-1 ring-zinc-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">Producto</th>
                <th className="px-4 py-3">Fracción</th>
                <th className="px-4 py-3 text-right">Entradas</th>
                <th className="px-4 py-3 text-right">Salidas</th>
                <th className="px-4 py-3 text-right">Existencia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {libro.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-zinc-400">
                    Sin productos controlados registrados.
                  </td>
                </tr>
              )}
              {libro.map((f) => (
                <tr key={f.producto} className="hover:bg-zinc-50">
                  <td className="px-4 py-3 font-medium text-zinc-900">
                    {f.producto}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {f.fraccion === "na" ? "—" : `Fracción ${f.fraccion}`}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-green-700">
                    {f.entradas}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-red-700">
                    {f.salidas}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-zinc-900">
                    {f.existencia}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white p-5 ring-1 ring-zinc-200">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-900">
        {value}
      </p>
    </div>
  );
}
