import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const money = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const TZ = "America/Mazatlan";
const hora = (iso: string) =>
  new Intl.DateTimeFormat("es-MX", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));

type Corte = {
  apertura: string | null;
  cierre: string;
  usuarios: { nombre: string } | null;
  total_ventas: number | null;
  total_cobros: number | null;
  total_efectivo: number | null;
  efectivo_contado: number | null;
  diferencia: number | null;
  total_productos: number | null;
  pacientes_atendidos: number | null;
};
type Venta = {
  id: string;
  folio: number;
  fecha: string;
  total: number;
  metodo_pago: string | null;
  pacientes: { nombre: string; apellidos: string | null } | null;
  venta_items: { cantidad: number; productos: { nombre: string } | null }[];
  pagos: { metodo: string; monto: number }[];
};
type Cobro = {
  id: string;
  fecha: string;
  total: number;
  pacientes: { nombre: string; apellidos: string | null } | null;
};

export default async function DetalleCortePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: corteData } = await supabase
    .from("cortes_caja")
    .select(
      "apertura, cierre, total_ventas, total_cobros, total_efectivo, efectivo_contado, diferencia, total_productos, pacientes_atendidos, usuarios(nombre)",
    )
    .eq("id", id)
    .single();
  if (!corteData) notFound();
  const corte = corteData as unknown as Corte;

  // Rango del corte. Si es un corte viejo sin `apertura`, se usa el inicio del
  // día (Sinaloa, UTC-7) del cierre.
  const cierre = corte.cierre;
  let desde = corte.apertura;
  if (!desde) {
    const ymd = new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(cierre));
    desde = `${ymd}T00:00:00-07:00`;
  }

  const { data: ventasData } = await supabase
    .from("ventas")
    .select(
      "id, folio, fecha, total, metodo_pago, pacientes(nombre, apellidos), venta_items(cantidad, productos(nombre)), pagos(metodo, monto)",
    )
    .eq("estado", "pagada")
    .gte("fecha", desde)
    .lte("fecha", cierre)
    .order("folio", { ascending: true });
  const ventas = (ventasData ?? []) as unknown as Venta[];

  const { data: cobrosData } = await supabase
    .from("cobros")
    .select("id, fecha, total, pacientes(nombre, apellidos)")
    .gte("fecha", desde)
    .lte("fecha", cierre)
    .order("fecha", { ascending: true });
  const cobros = (cobrosData ?? []) as unknown as Cobro[];

  const fechaTitulo = new Intl.DateTimeFormat("es-MX", {
    dateStyle: "full",
    timeZone: TZ,
  }).format(new Date(cierre));

  const nombre = (p: { nombre: string; apellidos: string | null } | null) =>
    p ? `${p.nombre} ${p.apellidos ?? ""}`.trim() : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link
          href="/cortes"
          className="text-sm text-zinc-500 hover:text-zinc-800"
        >
          ← Cortes
        </Link>
        <h1 className="mt-1 text-2xl font-semibold capitalize text-zinc-900">
          Corte — {fechaTitulo}
        </h1>
        <p className="text-sm text-zinc-500">
          Cerrado a las {hora(cierre)}
          {corte.usuarios?.nombre ? ` por ${corte.usuarios.nombre}` : ""}
        </p>
      </div>

      {/* Resumen guardado */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Dato label="Ventas (farmacia)" valor={money(Number(corte.total_ventas ?? 0))} />
        <Dato label="Cobros (consultorio)" valor={money(Number(corte.total_cobros ?? 0))} />
        <Dato
          label="Total"
          valor={money(Number(corte.total_ventas ?? 0) + Number(corte.total_cobros ?? 0))}
        />
        <Dato label="Productos salidos" valor={String(corte.total_productos ?? "—")} />
        <Dato label="Pacientes atendidos" valor={String(corte.pacientes_atendidos ?? "—")} />
        <Dato
          label="Efectivo esperado"
          valor={money(Number(corte.total_efectivo ?? 0))}
        />
        <Dato
          label="Efectivo contado"
          valor={corte.efectivo_contado == null ? "—" : money(Number(corte.efectivo_contado))}
        />
        <Dato
          label="Diferencia"
          valor={corte.diferencia == null ? "—" : money(Number(corte.diferencia))}
        />
      </div>

      {/* Ventas del corte */}
      <section>
        <h2 className="mb-2 text-lg font-medium text-zinc-900">
          Ventas de farmacia ({ventas.length})
        </h2>
        <div className="overflow-hidden rounded-xl bg-white ring-1 ring-zinc-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">Folio</th>
                <th className="px-4 py-3">Hora</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Productos</th>
                <th className="px-4 py-3">Método</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {ventas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-zinc-400">
                    Sin ventas en este corte.
                  </td>
                </tr>
              ) : (
                ventas.map((v) => {
                  const metodo =
                    (v.pagos ?? []).length > 1
                      ? "Mixto"
                      : (v.pagos?.[0]?.metodo ?? v.metodo_pago ?? "—");
                  return (
                    <tr key={v.id} className="align-top hover:bg-zinc-50">
                      <td className="px-4 py-3 font-medium text-zinc-900">#{v.folio}</td>
                      <td className="px-4 py-3 text-zinc-600">{hora(v.fecha)}</td>
                      <td className="px-4 py-3 text-zinc-600">
                        {nombre(v.pacientes) ?? "Mostrador"}
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        {(v.venta_items ?? [])
                          .map((it) => `${it.cantidad}× ${it.productos?.nombre ?? "—"}`)
                          .join(", ")}
                      </td>
                      <td className="px-4 py-3 capitalize text-zinc-600">{metodo}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-zinc-900">
                        {money(Number(v.total))}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Cobros del corte */}
      <section>
        <h2 className="mb-2 text-lg font-medium text-zinc-900">
          Cobros de consultorio ({cobros.length})
        </h2>
        <div className="overflow-hidden rounded-xl bg-white ring-1 ring-zinc-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">Hora</th>
                <th className="px-4 py-3">Paciente</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {cobros.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-zinc-400">
                    Sin cobros en este corte.
                  </td>
                </tr>
              ) : (
                cobros.map((c) => (
                  <tr key={c.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-3 text-zinc-600">{hora(c.fecha)}</td>
                    <td className="px-4 py-3 text-zinc-700">
                      {nombre(c.pacientes) ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-900">
                      {money(Number(c.total))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-zinc-200">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-0.5 text-base font-semibold tabular-nums text-zinc-900">
        {valor}
      </p>
    </div>
  );
}
