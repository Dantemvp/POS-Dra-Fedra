import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import MovimientosClient, { type Mov } from "./MovimientosClient";

export const metadata = { title: "Movimientos — Sistema Fedra" };

type Datos = Record<string, unknown>;
type Row = {
  id: number;
  accion: "INSERT" | "UPDATE" | "DELETE";
  tabla: string;
  registro_id: string | null;
  datos: { nuevo?: Datos; anterior?: Datos } | Datos | null;
  fecha: string;
  usuarios: { nombre: string; rol: string } | null;
};

const AREA: Record<string, { area: string; sust: string }> = {
  productos: { area: "Inventario", sust: "producto" },
  lotes: { area: "Inventario", sust: "stock/lote" },
  movimientos_inv: { area: "Inventario", sust: "movimiento de inventario" },
  compras: { area: "Compras", sust: "compra" },
  compra_items: { area: "Compras", sust: "renglón de compra" },
  ventas: { area: "POS", sust: "venta" },
  pagos: { area: "POS", sust: "pago" },
  cobros: { area: "Consultorio", sust: "cobro" },
  cobro_items: { area: "Consultorio", sust: "concepto de cobro" },
  recetas: { area: "Consultorio", sust: "receta" },
  receta_items: { area: "Consultorio", sust: "medicamento de receta" },
  servicios: { area: "Consultorio", sust: "servicio/precio" },
  pacientes: { area: "Pacientes", sust: "paciente" },
  historias_clinicas: { area: "Pacientes", sust: "historia clínica" },
};

const VERBO = { INSERT: "creó", UPDATE: "editó", DELETE: "eliminó" } as const;
const SEVERIDAD = { INSERT: "crear", UPDATE: "editar", DELETE: "eliminar" } as const;

// Campos cuyo cambio queremos resaltar, con su etiqueta legible.
const CAMPOS: Record<string, string> = {
  precio_venta: "precio",
  precio_unit: "precio",
  costo: "costo",
  total: "total",
  subtotal: "subtotal",
  stock_minimo: "mínimo",
  cantidad_actual: "stock",
  cantidad: "cantidad",
  activo: "activo",
  nombre: "nombre",
  estado: "estado",
  fase: "fase",
  caducidad: "caducidad",
  descripcion: "descripción",
};
const MONEY = new Set(["precio_venta", "precio_unit", "costo", "total", "subtotal"]);

const money = (n: unknown) =>
  Number(n).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

function val(campo: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (campo === "activo") return v ? "sí" : "no";
  if (MONEY.has(campo)) return money(v);
  return String(v);
}

function partes(datos: Row["datos"], accion: string) {
  if (!datos) return { nuevo: undefined, anterior: undefined };
  const d = datos as { nuevo?: Datos; anterior?: Datos };
  if (d.nuevo || d.anterior) return { nuevo: d.nuevo, anterior: d.anterior };
  // Formato viejo (plano): la fila completa.
  return accion === "DELETE"
    ? { anterior: datos as Datos, nuevo: undefined }
    : { nuevo: datos as Datos, anterior: undefined };
}

function nombreEntidad(tabla: string, row?: Datos): string | null {
  if (!row) return null;
  if (["productos", "servicios", "pacientes", "categorias", "proveedores"].includes(tabla))
    return (row.nombre as string) ?? null;
  if (tabla === "recetas" || tabla === "ventas")
    return row.folio != null ? `#${row.folio}` : null;
  if (tabla === "cobros") return row.total != null ? money(row.total) : null;
  return null;
}

function diff(anterior?: Datos, nuevo?: Datos): string | null {
  if (!anterior || !nuevo) return null;
  const out: string[] = [];
  for (const campo of Object.keys(CAMPOS)) {
    if (!(campo in nuevo) && !(campo in anterior)) continue;
    const a = anterior[campo];
    const b = nuevo[campo];
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    out.push(`${CAMPOS[campo]}: ${val(campo, a)} → ${val(campo, b)}`);
    if (out.length >= 3) break;
  }
  return out.length ? out.join(" · ") : null;
}

export default async function MovimientosPage() {
  const yo = await getUsuarioActual();
  if (!yo) redirect("/login");
  if (yo.rol !== "admin" && yo.rol !== "doctora") redirect("/dashboard");

  // Service-role: la bitácora solo la lee admin (RLS), aquí ya validamos rol.
  const admin = createAdminClient();
  const { data } = await admin
    .from("audit_log")
    .select("id, accion, tabla, registro_id, datos, fecha, usuarios(nombre, rol)")
    .not("usuario_id", "is", null) // oculta el ruido de la migración (sin sesión)
    .order("fecha", { ascending: false })
    .limit(500);

  const rows = (data ?? []) as unknown as Row[];

  const movimientos: Mov[] = rows.map((r) => {
    const meta = AREA[r.tabla] ?? { area: "Otro", sust: r.tabla };
    const { nuevo, anterior } = partes(r.datos, r.accion);
    const nom = nombreEntidad(r.tabla, nuevo ?? anterior);
    const verbo = VERBO[r.accion] ?? r.accion.toLowerCase();
    const titulo = `${verbo} ${meta.sust}${nom ? ` «${nom}»` : ""}`;
    const detalle = r.accion === "UPDATE" ? diff(anterior, nuevo) : null;
    return {
      id: r.id,
      fecha: r.fecha,
      persona: r.usuarios?.nombre ?? "—",
      rol: r.usuarios?.rol ?? "—",
      area: meta.area,
      severidad: SEVERIDAD[r.accion] ?? "editar",
      titulo,
      detalle,
    };
  });

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-1 text-2xl font-semibold text-zinc-900">Movimientos</h1>
      <p className="mb-6 text-sm text-zinc-500">
        Actividad del personal: ediciones, descuentos, eliminaciones y cambios
        sensibles quedan registrados aquí — quién, qué y cuándo.
      </p>
      <MovimientosClient movimientos={movimientos} />
    </div>
  );
}
