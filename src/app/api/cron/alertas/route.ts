import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarARoles } from "@/lib/push";
import { inicioDiaSinaloa, ymdSinaloa, horaSinaloa } from "@/lib/tz";

export const dynamic = "force-dynamic";

// Cron diario (mañana). Vercel agrega el header Authorization: Bearer <CRON_SECRET>
// automáticamente cuando CRON_SECRET está definido en el proyecto.
function autorizado(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

const DIAS_CADUCIDAD = 30; // avisar lo que caduca dentro de este rango

export async function GET(req: Request) {
  if (!autorizado(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const admin = createAdminClient();
  const hoy = new Date();
  const inicio = inicioDiaSinaloa(hoy);
  const fin = new Date(inicio.getTime() + 24 * 60 * 60 * 1000);
  const limiteCad = ymdSinaloa(
    new Date(hoy.getTime() + DIAS_CADUCIDAD * 24 * 60 * 60 * 1000),
  );
  const hoyYmd = ymdSinaloa(hoy);

  // 1) Caducidades próximas (lotes con stock que caducan en <= 30 días)
  const { data: lotes } = await admin
    .from("lotes")
    .select("caducidad, cantidad_actual, productos(nombre)")
    .gt("cantidad_actual", 0)
    .not("caducidad", "is", null)
    .lte("caducidad", limiteCad)
    .order("caducidad", { ascending: true });
  const caducando = (lotes ?? []) as unknown as {
    caducidad: string;
    cantidad_actual: number;
    productos: { nombre: string } | null;
  }[];

  // 2) Stock bajo (suma de lotes <= stock_minimo, con mínimo definido)
  const { data: prods } = await admin
    .from("productos")
    .select("nombre, stock_minimo, lotes(cantidad_actual)")
    .eq("activo", true)
    .gt("stock_minimo", 0);
  const bajos = ((prods ?? []) as unknown as {
    nombre: string;
    stock_minimo: number;
    lotes: { cantidad_actual: number }[];
  }[])
    .map((p) => ({
      nombre: p.nombre,
      stock: (p.lotes ?? []).reduce((s, l) => s + Number(l.cantidad_actual ?? 0), 0),
      min: Number(p.stock_minimo),
    }))
    .filter((p) => p.stock <= p.min);

  // 3) Citas de hoy
  const { data: citas } = await admin
    .from("citas")
    .select("fecha_hora, estado, pacientes(nombre, apellidos)")
    .gte("fecha_hora", inicio.toISOString())
    .lt("fecha_hora", fin.toISOString())
    .neq("estado", "cancelada")
    .order("fecha_hora", { ascending: true });
  const citasHoy = (citas ?? []) as unknown as {
    fecha_hora: string;
    pacientes: { nombre: string; apellidos: string | null } | null;
  }[];

  const enviados: string[] = [];

  // Notificación de inventario (caducidades + stock bajo) — una sola, agrupada.
  if (caducando.length > 0 || bajos.length > 0) {
    const partes: string[] = [];
    if (caducando.length > 0) {
      const ej = caducando[0];
      partes.push(
        `${caducando.length} por caducar (ej. ${ej.productos?.nombre ?? "producto"} ${ej.caducidad})`,
      );
    }
    if (bajos.length > 0) {
      partes.push(`${bajos.length} con stock bajo (ej. ${bajos[0].nombre})`);
    }
    await enviarARoles(["admin", "farmacia", "doctora"], {
      title: "⚠️ Inventario para revisar",
      body: partes.join(" · "),
      url: "/inventario",
      tag: "inventario-diario",
    });
    enviados.push("inventario");
  }

  // Notificación de agenda del día.
  if (citasHoy.length > 0) {
    const primera = citasHoy[0];
    const nom = primera.pacientes
      ? `${primera.pacientes.nombre} ${primera.pacientes.apellidos ?? ""}`.trim()
      : "paciente";
    await enviarARoles(["admin", "doctora", "asistente"], {
      title: `📅 Hoy: ${citasHoy.length} cita${citasHoy.length === 1 ? "" : "s"}`,
      body: `Primera: ${nom} a las ${horaSinaloa(primera.fecha_hora)}.`,
      url: "/agenda",
      tag: "agenda-diaria",
    });
    enviados.push("agenda");
  }

  return NextResponse.json({
    ok: true,
    fecha: hoyYmd,
    caducando: caducando.length,
    stock_bajo: bajos.length,
    citas_hoy: citasHoy.length,
    enviados,
  });
}
