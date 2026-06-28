import { createClient } from "@/lib/supabase/server";
import { inicioDiaSinaloa, horaSinaloa } from "@/lib/tz";
import CorteDelDia from "./CorteDelDia";
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
type CobroRow = {
  id: string;
  total: number;
  paciente_id: string | null;
  cobro_pagos: { metodo: string; monto: number }[];
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
  // Efectivo del corte: se suma desde la tabla `pagos` (monto por método), para
  // que una venta con pago mixto (efectivo + tarjeta) aporte solo su parte en
  // efectivo y la caja cuadre. Ventas viejas sin filas en `pagos` caen al
  // metodo_pago de la cabecera.
  const efectivo = ventas.reduce((s, v) => {
    const pagos = v.pagos ?? [];
    if (pagos.length === 0) {
      return s + (v.metodo_pago === "efectivo" ? Number(v.total) : 0);
    }
    return (
      s +
      pagos
        .filter((p) => p.metodo === "efectivo")
        .reduce((a, p) => a + Number(p.monto), 0)
    );
  }, 0);

  // Unidades de producto que salieron por ventas en el día.
  const productosSalidos = ventas.reduce(
    (s, v) =>
      s + (v.venta_items ?? []).reduce((a, it) => a + Number(it.cantidad), 0),
    0,
  );

  // Cobros del consultorio del día: ingresos + pacientes atendidos + efectivo.
  const { data: cobrosData } = await supabase
    .from("cobros")
    .select("id, total, paciente_id, cobro_pagos(metodo, monto)")
    .gte("fecha", desde);
  const cobros = (cobrosData ?? []) as unknown as CobroRow[];
  const totalCobros = cobros.reduce((s, c) => s + Number(c.total), 0);
  const pacientesAtendidos = cobros.filter((c) => c.paciente_id).length;
  const efectivoCobros = cobros.reduce(
    (s, c) =>
      s +
      (c.cobro_pagos ?? [])
        .filter((p) => p.metodo === "efectivo")
        .reduce((a, p) => a + Number(p.monto), 0),
    0,
  );
  // Efectivo esperado en el cajón = ventas en efectivo + cobros en efectivo.
  const efectivoEsperado = efectivo + efectivoCobros;

  // Desglose por método de todo el día (ventas + cobros).
  const desglose: Record<string, number> = {};
  for (const v of ventas) {
    const pgs = v.pagos ?? [];
    if (pgs.length === 0) {
      const m = v.metodo_pago ?? "otro";
      desglose[m] = (desglose[m] ?? 0) + Number(v.total);
    } else {
      for (const p of pgs)
        desglose[p.metodo] = (desglose[p.metodo] ?? 0) + Number(p.monto);
    }
  }
  for (const c of cobros) {
    for (const p of c.cobro_pagos ?? [])
      desglose[p.metodo] = (desglose[p.metodo] ?? 0) + Number(p.monto);
  }

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

  const fechaCorte = new Intl.DateTimeFormat("es-MX", {
    dateStyle: "full",
    timeZone: "America/Mazatlan",
  }).format(new Date());

  // Historial de cortes anteriores.
  const { data: cortesData } = await supabase
    .from("cortes_caja")
    .select(
      "id, cierre, total_ventas, total_cobros, total_efectivo, efectivo_contado, diferencia",
    )
    .not("cierre", "is", null)
    .order("cierre", { ascending: false })
    .limit(10);
  const cortes = (cortesData ?? []) as {
    id: string;
    cierre: string;
    total_ventas: number | null;
    total_cobros: number | null;
    total_efectivo: number | null;
    efectivo_contado: number | null;
    diferencia: number | null;
  }[];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <h1 className="text-2xl font-semibold text-zinc-900">Caja y reportes</h1>

      {/* Corte / resumen del día */}
      <section>
        <CorteDelDia
          numVentas={ventas.length}
          totalVentas={totalDia}
          totalCobros={totalCobros}
          productosSalidos={productosSalidos}
          pacientesAtendidos={pacientesAtendidos}
          efectivoEsperado={efectivoEsperado}
          desglose={desglose}
          fecha={fechaCorte}
        />
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

      {/* Historial de cortes */}
      {cortes.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-medium text-zinc-900">
            Cortes anteriores
          </h2>
          <div className="overflow-hidden rounded-xl bg-white ring-1 ring-zinc-200">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Cierre</th>
                  <th className="px-4 py-3 text-right">Ventas</th>
                  <th className="px-4 py-3 text-right">Cobros</th>
                  <th className="px-4 py-3 text-right">Efectivo esperado</th>
                  <th className="px-4 py-3 text-right">Contado</th>
                  <th className="px-4 py-3 text-right">Diferencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {cortes.map((c) => (
                  <tr key={c.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-3 text-zinc-700">
                      {new Intl.DateTimeFormat("es-MX", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "America/Mazatlan",
                      }).format(new Date(c.cierre))}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-700">
                      {money(Number(c.total_ventas ?? 0))}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-700">
                      {money(Number(c.total_cobros ?? 0))}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-700">
                      {money(Number(c.total_efectivo ?? 0))}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-700">
                      {c.efectivo_contado == null
                        ? "—"
                        : money(Number(c.efectivo_contado))}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {c.diferencia == null ? (
                        "—"
                      ) : (
                        <span
                          className={
                            Number(c.diferencia) === 0
                              ? "text-green-700"
                              : Number(c.diferencia) > 0
                                ? "text-amber-700"
                                : "text-red-600"
                          }
                        >
                          {money(Number(c.diferencia))}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
