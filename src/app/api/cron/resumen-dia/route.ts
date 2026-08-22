import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarARoles } from "@/lib/push";
import { inicioDiaSinaloa, ymdSinaloa } from "@/lib/tz";

export const dynamic = "force-dynamic";

function autorizado(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

const fmt = (n: number) =>
  Number(n).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

// Cron al cierre del día (noche). Resume ventas de farmacia + cobros de consultorio.
export async function GET(req: Request) {
  if (!autorizado(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const admin = createAdminClient();
  const inicio = inicioDiaSinaloa(new Date());
  const fin = new Date(inicio.getTime() + 24 * 60 * 60 * 1000);
  const desde = inicio.toISOString();
  const hasta = fin.toISOString();

  const [{ data: ventas }, { data: cobros }] = await Promise.all([
    admin
      .from("ventas")
      .select("total, estado")
      .gte("fecha", desde)
      .lt("fecha", hasta),
    admin
      .from("cobros")
      .select("total")
      .neq("estado", "cancelado")
      .gte("fecha", desde)
      .lt("fecha", hasta),
  ]);

  const ventasPagadas = (ventas ?? []).filter(
    (v) => (v as { estado?: string }).estado !== "cancelada",
  );
  const totalVentas = ventasPagadas.reduce(
    (s, v) => s + Number((v as { total: number }).total ?? 0),
    0,
  );
  const totalCobros = (cobros ?? []).reduce(
    (s, c) => s + Number((c as { total: number }).total ?? 0),
    0,
  );
  const total = totalVentas + totalCobros;
  const nOps = ventasPagadas.length + (cobros ?? []).length;

  // Si no hubo movimiento, no molestamos con una notificación.
  if (nOps === 0) {
    return NextResponse.json({ ok: true, sin_movimiento: true, fecha: ymdSinaloa() });
  }

  const push = await enviarARoles(["admin", "doctora", "gerente"], {
    title: `🧾 Cierre del día: ${fmt(total)}`,
    body: `Farmacia ${fmt(totalVentas)} · Consultorio ${fmt(totalCobros)} · ${nOps} operaciones.`,
    url: "/caja",
    tag: "resumen-dia",
  });

  return NextResponse.json({
    ok: true,
    fecha: ymdSinaloa(),
    ventas: totalVentas,
    cobros: totalCobros,
    total,
    operaciones: nOps,
    push,
  });
}
