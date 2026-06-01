import { getUsuarioActual } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { VentasDiaChart, MetodoChart, TopProductosChart } from "./Charts";

const money = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

const METODO_LABEL: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  otro: "Otro",
};

export default async function DashboardPage() {
  const usuario = await getUsuarioActual();
  const rol = usuario?.rol ?? "asistente";
  const verFarmacia = rol === "admin" || rol === "farmacia";
  const verClinica =
    rol === "admin" || rol === "doctora" || rol === "asistente";
  const supabase = await createClient();

  // ---- Datos de farmacia ----
  let ventasPorDia: { dia: string; total: number }[] = [];
  let porMetodo: { name: string; value: number }[] = [];
  let topProductos: { nombre: string; cantidad: number }[] = [];
  let totalDia = 0;
  let ventasDiaCount = 0;
  let totalSemana = 0;
  let stockBajo: { nombre: string; stock: number; minimo: number }[] = [];
  let porCaducar: { nombre: string; lote: string | null; caducidad: string }[] =
    [];

  if (verFarmacia) {
    const inicioHoy = new Date();
    inicioHoy.setHours(0, 0, 0, 0);
    const desde14 = new Date(inicioHoy);
    desde14.setDate(desde14.getDate() - 13);

    const { data: ventas } = await supabase
      .from("ventas")
      .select("fecha, total, metodo_pago")
      .gte("fecha", desde14.toISOString())
      .eq("estado", "pagada");

    const dias = new Map<string, number>();
    for (let i = 0; i < 14; i++) {
      const d = new Date(desde14);
      d.setDate(d.getDate() + i);
      dias.set(d.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit" }), 0);
    }
    const metodoMap = new Map<string, number>();
    for (const v of ventas ?? []) {
      const f = new Date(v.fecha as string);
      const key = f.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit" });
      if (dias.has(key)) dias.set(key, dias.get(key)! + Number(v.total));
      const m = (v.metodo_pago as string) ?? "otro";
      metodoMap.set(m, (metodoMap.get(m) ?? 0) + Number(v.total));
      if (f >= inicioHoy) {
        totalDia += Number(v.total);
        ventasDiaCount += 1;
      }
      totalSemana += Number(v.total);
    }
    ventasPorDia = Array.from(dias, ([dia, total]) => ({ dia, total }));
    porMetodo = Array.from(metodoMap, ([k, value]) => ({
      name: METODO_LABEL[k] ?? k,
      value,
    }));

    // Top productos (por cantidad vendida)
    const { data: items } = await supabase
      .from("venta_items")
      .select("cantidad, productos(nombre)")
      .limit(2000);
    const prodMap = new Map<string, number>();
    for (const it of (items ?? []) as unknown as {
      cantidad: number;
      productos: { nombre: string } | null;
    }[]) {
      const n = it.productos?.nombre ?? "—";
      prodMap.set(n, (prodMap.get(n) ?? 0) + Number(it.cantidad));
    }
    topProductos = Array.from(prodMap, ([nombre, cantidad]) => ({
      nombre,
      cantidad,
    }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 5);

    // Stock bajo + por caducar
    const { data: productos } = await supabase
      .from("productos")
      .select("nombre, stock_minimo, lotes(cantidad_actual, caducidad, lote)")
      .eq("activo", true);
    const hoy = new Date();
    const en30 = new Date();
    en30.setDate(en30.getDate() + 30);
    for (const p of (productos ?? []) as unknown as {
      nombre: string;
      stock_minimo: number;
      lotes: { cantidad_actual: number; caducidad: string | null; lote: string | null }[];
    }[]) {
      const stock = (p.lotes ?? []).reduce(
        (s, l) => s + Number(l.cantidad_actual ?? 0),
        0,
      );
      if (stock <= Number(p.stock_minimo ?? 0))
        stockBajo.push({ nombre: p.nombre, stock, minimo: Number(p.stock_minimo) });
      for (const l of p.lotes ?? []) {
        if (
          l.caducidad &&
          Number(l.cantidad_actual) > 0 &&
          new Date(l.caducidad) <= en30 &&
          new Date(l.caducidad) >= hoy
        )
          porCaducar.push({ nombre: p.nombre, lote: l.lote, caducidad: l.caducidad });
      }
    }
  }

  // ---- Datos de consultorio ----
  let totalPacientes = 0;
  let pacientesNuevosMes = 0;
  if (verClinica) {
    const { count } = await supabase
      .from("pacientes")
      .select("*", { count: "exact", head: true });
    totalPacientes = count ?? 0;

    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);
    const { count: nuevos } = await supabase
      .from("pacientes")
      .select("*", { count: "exact", head: true })
      .gte("creado_en", inicioMes.toISOString());
    pacientesNuevosMes = nuevos ?? 0;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">
          Hola, {usuario?.nombre}
        </h1>
        <p className="mt-1 text-sm capitalize text-zinc-500">{rol}</p>
      </div>

      {verFarmacia && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi label="Ventas de hoy" value={String(ventasDiaCount)} />
            <Kpi label="Total de hoy" value={money(totalDia)} />
            <Kpi label="Últimos 14 días" value={money(totalSemana)} />
            <Kpi
              label="Stock bajo"
              value={String(stockBajo.length)}
              alerta={stockBajo.length > 0}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Panel titulo="Ventas por día (14 días)">
              <VentasDiaChart data={ventasPorDia} />
            </Panel>
            <Panel titulo="Ingresos por método de pago">
              <MetodoChart data={porMetodo} />
            </Panel>
            <Panel titulo="Productos más vendidos">
              <TopProductosChart data={topProductos} />
            </Panel>
            <Panel titulo="Alertas de inventario">
              <div className="space-y-4">
                <div>
                  <p className="mb-1 text-xs font-medium uppercase text-zinc-500">
                    Stock bajo
                  </p>
                  {stockBajo.length === 0 ? (
                    <p className="text-sm text-zinc-400">Todo en orden.</p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {stockBajo.slice(0, 5).map((p) => (
                        <li key={p.nombre} className="flex justify-between">
                          <span className="text-zinc-800">{p.nombre}</span>
                          <span className="font-medium text-amber-700">
                            {p.stock} / {p.minimo}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium uppercase text-zinc-500">
                    Por caducar (30 días)
                  </p>
                  {porCaducar.length === 0 ? (
                    <p className="text-sm text-zinc-400">Ninguno próximo.</p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {porCaducar.slice(0, 5).map((p, i) => (
                        <li key={i} className="flex justify-between">
                          <span className="text-zinc-800">{p.nombre}</span>
                          <span className="font-medium text-red-700">
                            {new Date(p.caducidad).toLocaleDateString("es-MX")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </Panel>
          </div>
        </>
      )}

      {verClinica && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi label="Pacientes totales" value={String(totalPacientes)} />
          <Kpi label="Nuevos este mes" value={String(pacientesNuevosMes)} />
        </div>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  alerta,
}: {
  label: string;
  value: string;
  alerta?: boolean;
}) {
  return (
    <div className="rounded-xl bg-white p-5 ring-1 ring-zinc-200">
      <p className="text-sm text-zinc-500">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold tabular-nums ${
          alerta ? "text-amber-600" : "text-zinc-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Panel({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-white p-5 ring-1 ring-zinc-200">
      <h2 className="mb-3 text-sm font-medium text-zinc-900">{titulo}</h2>
      {children}
    </div>
  );
}
