import Link from "next/link";
import { getUsuarioActual } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { inicioDiaSinaloa, etiquetaDiaCorta, horaSinaloa } from "@/lib/tz";
import {
  VentasDiaChart,
  MetodoChart,
  TopProductosChart,
  PacientesFaseChart,
  PorMesChart,
  IngresosMesChart,
} from "./Charts.lazy";
import {
  confirmacionVencida,
  necesitaConfirmar,
} from "../agenda/confirmacion";

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
  const verFarmacia = rol === "admin" || rol === "farmacia" || rol === "gerente";
  const verClinica =
    rol === "admin" || rol === "doctora" || rol === "asistente" || rol === "gerente";
  const supabase = await createClient();

  // ---- Datos de farmacia ----
  let ventasPorDia: { dia: string; total: number }[] = [];
  let porMetodo: { name: string; value: number }[] = [];
  let topProductos: { nombre: string; cantidad: number }[] = [];
  let totalDia = 0;
  let ventasDiaCount = 0;
  let totalSemana = 0;
  const stockBajo: { nombre: string; stock: number; minimo: number }[] = [];
  const porCaducar: {
    nombre: string;
    lote: string | null;
    caducidad: string;
  }[] = [];

  if (verFarmacia) {
    // Fronteras de día EN SINALOA (no en UTC del servidor).
    const inicioHoy = inicioDiaSinaloa();
    const desde14 = new Date(inicioHoy.getTime() - 13 * 86_400_000);

    const { data: ventas } = await supabase
      .from("ventas")
      .select("fecha, total, metodo_pago")
      .gte("fecha", desde14.toISOString())
      .eq("estado", "pagada");

    const dias = new Map<string, number>();
    for (let i = 0; i < 14; i++) {
      const d = new Date(desde14.getTime() + i * 86_400_000);
      dias.set(etiquetaDiaCorta(d), 0);
    }
    const metodoMap = new Map<string, number>();
    for (const v of ventas ?? []) {
      const f = new Date(v.fecha as string);
      const key = etiquetaDiaCorta(f);
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
      const min = Number(p.stock_minimo ?? 0);
      if (min > 0 && stock <= min)
        stockBajo.push({ nombre: p.nombre, stock, minimo: min });
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
  let citasPorConfirmar = 0;
  let citasVencidas = 0;
  let citasHoy: {
    id: string;
    fecha_hora: string;
    estado: string;
    paciente: { id: string; nombre: string; apellidos: string | null } | null;
  }[] = [];
  // paciente_id -> { fase actual, último peso } tomado de su última receta
  const infoPac: Record<string, { fase: number | null; peso: string | null }> =
    {};
  // KPIs nuevos
  let pacientesFase: { fase: string; pacientes: number }[] = [];
  let porMes: { mes: string; recetas: number; citas: number }[] = [];
  let ingresosMes: { mes: string; total: number }[] = [];
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

    // Citas próximas pendientes de confirmar (y cuántas ya pasaron su límite).
    const ahora = new Date();
    const { data: citas } = await supabase
      .from("citas")
      .select("estado, fecha_hora, limite_confirmacion")
      .eq("estado", "agendada")
      .gte("fecha_hora", ahora.toISOString());
    for (const c of (citas ?? []) as {
      estado: string;
      fecha_hora: string;
      limite_confirmacion: string | null;
    }[]) {
      if (necesitaConfirmar(c.estado)) citasPorConfirmar += 1;
      if (
        confirmacionVencida(
          c.estado,
          c.fecha_hora,
          c.limite_confirmacion,
          ahora,
        )
      )
        citasVencidas += 1;
    }

    // Citas de hoy (de inicio del día de Sinaloa al inicio del siguiente).
    const inicioHoyCl = inicioDiaSinaloa();
    const finHoyCl = new Date(inicioHoyCl.getTime() + 86_400_000);
    const { data: hoy } = await supabase
      .from("citas")
      .select(
        "id, fecha_hora, estado, paciente:pacientes(id, nombre, apellidos)",
      )
      .gte("fecha_hora", inicioHoyCl.toISOString())
      .lt("fecha_hora", finHoyCl.toISOString())
      .neq("estado", "cancelada")
      .order("fecha_hora");
    citasHoy = (hoy ?? []) as unknown as typeof citasHoy;

    // Fase actual + último peso de los pacientes de hoy (de su última receta).
    const ids = [
      ...new Set(
        citasHoy.map((c) => c.paciente?.id).filter((x): x is string => !!x),
      ),
    ];
    if (ids.length > 0) {
      const { data: recs } = await supabase
        .from("recetas")
        .select("paciente_id, fase, metricas, fecha")
        .in("paciente_id", ids)
        .order("fecha", { ascending: false });
      for (const r of (recs ?? []) as {
        paciente_id: string;
        fase: number | null;
        metricas: Record<string, string> | null;
        fecha: string;
      }[]) {
        if (!infoPac[r.paciente_id])
          infoPac[r.paciente_id] = {
            fase: r.fase ?? null,
            peso: r.metricas?.peso ?? null,
          };
      }
    }

    // --- Pacientes por fase (fase actual = última receta con fase) ---
    const { data: recFase } = await supabase
      .from("recetas")
      .select("paciente_id, fase, fecha")
      .not("fase", "is", null)
      .order("fecha", { ascending: false });
    const faseActualPac = new Map<string, number>();
    for (const r of (recFase ?? []) as {
      paciente_id: string;
      fase: number;
      fecha: string;
    }[]) {
      if (!faseActualPac.has(r.paciente_id))
        faseActualPac.set(r.paciente_id, r.fase);
    }
    const conteoFase = new Map<number, number>();
    for (const f of faseActualPac.values())
      conteoFase.set(f, (conteoFase.get(f) ?? 0) + 1);
    pacientesFase = [...conteoFase.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([f, n]) => ({ fase: `Fase ${f}`, pacientes: n }));

    // --- Últimos 12 meses: claves YYYY-MM en Sinaloa ---
    const mesKey = (iso: string) =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Mazatlan",
        year: "numeric",
        month: "2-digit",
      }).format(new Date(iso));
    const meses: string[] = [];
    const base = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      meses.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      );
    }
    const etiquetaMes = (k: string) => {
      const [y, m] = k.split("-");
      return (
        new Intl.DateTimeFormat("es-MX", { month: "short" }).format(
          new Date(Number(y), Number(m) - 1, 1),
        ) + ` ${y.slice(2)}`
      );
    };
    const desde12 = `${meses[0]}-01T00:00:00-07:00`;

    const [{ data: recMes }, { data: citMes }, { data: cobMes }] =
      await Promise.all([
        supabase.from("recetas").select("fecha").gte("fecha", desde12),
        supabase.from("citas").select("fecha_hora").gte("fecha_hora", desde12),
        supabase.from("cobros").select("fecha, total").gte("fecha", desde12),
      ]);

    const rMap = new Map<string, number>();
    const cMap = new Map<string, number>();
    const iMap = new Map<string, number>();
    for (const x of (recMes ?? []) as { fecha: string }[]) {
      const k = mesKey(x.fecha);
      rMap.set(k, (rMap.get(k) ?? 0) + 1);
    }
    for (const x of (citMes ?? []) as { fecha_hora: string }[]) {
      const k = mesKey(x.fecha_hora);
      cMap.set(k, (cMap.get(k) ?? 0) + 1);
    }
    for (const x of (cobMes ?? []) as { fecha: string; total: number }[]) {
      const k = mesKey(x.fecha);
      iMap.set(k, (iMap.get(k) ?? 0) + Number(x.total));
    }
    porMes = meses.map((k) => ({
      mes: etiquetaMes(k),
      recetas: rMap.get(k) ?? 0,
      citas: cMap.get(k) ?? 0,
    }));
    ingresosMes = meses.map((k) => ({
      mes: etiquetaMes(k),
      total: iMap.get(k) ?? 0,
    }));
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <div className="order-1">
        <h1 className="text-2xl font-semibold text-zinc-900">
          Hola, {usuario?.nombre}
        </h1>
        <p className="mt-1 text-sm capitalize text-zinc-500">{rol}</p>
      </div>

      {verFarmacia && (
        <div className="order-3 flex flex-col gap-6">
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
        </div>
      )}

      {verClinica && (
        <div className="order-2 space-y-4">
          {citasPorConfirmar > 0 && (
            <Link
              href="/agenda"
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm ring-1 transition hover:brightness-95 ${
                citasVencidas > 0
                  ? "bg-red-50 text-red-800 ring-red-200"
                  : "bg-amber-50 text-amber-800 ring-amber-200"
              }`}
            >
              <span className="text-lg leading-none">
                {citasVencidas > 0 ? "⚠️" : "🔔"}
              </span>
              <span>
                <strong>{citasPorConfirmar}</strong> cita
                {citasPorConfirmar === 1 ? "" : "s"} por confirmar
                {citasVencidas > 0 && (
                  <>
                    {" "}
                    — <strong>{citasVencidas}</strong> ya pasó
                    {citasVencidas === 1 ? "" : "ron"} su fecha límite
                  </>
                )}
                . Ir a la agenda →
              </span>
            </Link>
          )}

          {/* Pacientes del día — clic para abrir el expediente */}
          <div className="rounded-xl bg-white p-5 ring-1 ring-zinc-200">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium text-zinc-900">
                Pacientes de hoy
              </h2>
              <Link
                href="/agenda"
                className="text-xs font-medium text-zinc-500 hover:text-zinc-900"
              >
                Ver agenda →
              </Link>
            </div>
            {citasHoy.length === 0 ? (
              <p className="py-6 text-center text-sm text-zinc-400">
                No hay pacientes agendados para hoy.
              </p>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {citasHoy.map((c) => {
                  const info = c.paciente ? infoPac[c.paciente.id] : undefined;
                  return (
                    <li key={c.id}>
                      <Link
                        href={
                          c.paciente ? `/pacientes/${c.paciente.id}` : "#"
                        }
                        className="-mx-2 flex items-center justify-between rounded-lg px-2 py-2.5 text-sm transition hover:bg-zinc-50"
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <span className="w-12 shrink-0 font-medium tabular-nums text-zinc-900">
                            {horaSinaloa(c.fecha_hora)}
                          </span>
                          <span className="truncate font-medium text-zinc-800">
                            {c.paciente
                              ? `${c.paciente.nombre} ${c.paciente.apellidos ?? ""}`
                              : "—"}
                          </span>
                          {info?.fase != null && (
                            <span className="shrink-0 rounded-full bg-[#efe7db] px-2 py-0.5 text-[10px] font-medium text-[#8c7a63]">
                              Fase {info.fase}
                            </span>
                          )}
                          {info?.peso && (
                            <span className="shrink-0 text-xs text-zinc-400">
                              {info.peso} kg
                            </span>
                          )}
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
                              c.estado === "confirmada"
                                ? "bg-green-100 text-green-700"
                                : c.estado === "agendada"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-zinc-200 text-zinc-600"
                            }`}
                          >
                            {c.estado}
                          </span>
                          <span className="text-zinc-300">›</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi label="Pacientes totales" value={String(totalPacientes)} />
            <Kpi label="Nuevos este mes" value={String(pacientesNuevosMes)} />
            <Kpi label="Citas de hoy" value={String(citasHoy.length)} />
            <Kpi
              label="Citas por confirmar"
              value={String(citasPorConfirmar)}
              alerta={citasPorConfirmar > 0}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Panel titulo="Pacientes por fase">
              <PacientesFaseChart data={pacientesFase} />
            </Panel>
            <Panel titulo="Ingresos del consultorio por mes">
              <IngresosMesChart data={ingresosMes} />
            </Panel>
            <div className="lg:col-span-2">
              <Panel titulo="Recetas y citas por mes (12 meses)">
                <PorMesChart data={porMes} />
              </Panel>
            </div>
          </div>
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
