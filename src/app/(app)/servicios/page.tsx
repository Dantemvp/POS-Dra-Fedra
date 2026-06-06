import { createClient } from "@/lib/supabase/server";
import ServiciosClient, { type Servicio } from "./ServiciosClient";

export default async function ServiciosPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("servicios")
    .select("id, nombre, categoria, precio, activo")
    .order("categoria")
    .order("nombre");

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-2xl font-semibold text-zinc-900">Servicios</h1>
      <p className="mb-6 text-sm text-zinc-500">
        Catálogo de tratamientos y fases. Los precios se usan para cobrar en
        segundos.
      </p>
      <ServiciosClient servicios={(data ?? []) as Servicio[]} />
    </div>
  );
}
