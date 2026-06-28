import { createClient } from "@/lib/supabase/server";
import ListaCortes, { type CorteLista } from "./ListaCortes";

export default async function CortesPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("cortes_caja")
    .select(
      "id, cierre, total_ventas, total_cobros, total_efectivo, efectivo_contado, diferencia, total_productos, pacientes_atendidos",
    )
    .not("cierre", "is", null)
    .order("cierre", { ascending: false })
    .limit(1000);

  const cortes: CorteLista[] = (data ?? []).map((c) => ({
    id: c.id as string,
    cierre: c.cierre as string,
    totalVentas: Number(c.total_ventas ?? 0),
    totalCobros: Number(c.total_cobros ?? 0),
    efectivoEsperado: Number(c.total_efectivo ?? 0),
    efectivoContado: c.efectivo_contado == null ? null : Number(c.efectivo_contado),
    diferencia: c.diferencia == null ? null : Number(c.diferencia),
    productos: c.total_productos == null ? null : Number(c.total_productos),
    pacientes: c.pacientes_atendidos == null ? null : Number(c.pacientes_atendidos),
  }));

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-1 text-2xl font-semibold text-zinc-900">
        Historial de cortes
      </h1>
      <p className="mb-6 text-sm text-zinc-500">
        Todos los cortes de caja, por año y mes. Abre uno para ver sus
        movimientos.
      </p>
      <ListaCortes cortes={cortes} />
    </div>
  );
}
