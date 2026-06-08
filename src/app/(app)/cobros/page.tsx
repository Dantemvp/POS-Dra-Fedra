import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fechaSinaloa } from "@/lib/tz";
import NuevoCobro, { type Paciente, type Servicio, type Producto } from "./NuevoCobro";

type CobroRow = {
  id: string;
  fecha: string;
  total: number;
  pacientes: { nombre: string; apellidos: string | null } | null;
  cobro_pagos: { metodo: string }[];
};

const fmt = (n: number) =>
  Number(n).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export default async function CobrosPage() {
  const supabase = await createClient();

  const [{ data: pac }, { data: srv }, { data: prod }, { data: cob }] =
    await Promise.all([
      supabase.from("pacientes").select("id, nombre, apellidos").order("nombre"),
      supabase
        .from("servicios")
        .select("id, nombre, precio")
        .eq("activo", true)
        .order("nombre"),
      supabase
        .from("productos")
        .select("id, nombre, precio_venta, codigo_barras, lotes(cantidad_actual)")
        .eq("activo", true)
        .order("nombre"),
      supabase
        .from("cobros")
        .select(
          "id, fecha, total, pacientes(nombre, apellidos), cobro_pagos(metodo)",
        )
        .order("fecha", { ascending: false })
        .limit(50),
    ]);

  const pacientes: Paciente[] = (pac ?? []).map((p) => ({
    id: p.id as string,
    nombre: `${p.nombre}${p.apellidos ? " " + p.apellidos : ""}`,
  }));
  const servicios = (srv ?? []) as Servicio[];
  const productos: Producto[] = (
    (prod ?? []) as unknown as {
      id: string;
      nombre: string;
      precio_venta: number;
      codigo_barras: string | null;
      lotes: { cantidad_actual: number }[];
    }[]
  ).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    precio: Number(p.precio_venta),
    codigo_barras: p.codigo_barras,
    stock: (p.lotes ?? []).reduce((s, l) => s + Number(l.cantidad_actual ?? 0), 0),
  }));
  const cobros = (cob ?? []) as unknown as CobroRow[];

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_1.1fr]">
      <div>
        <h1 className="mb-1 text-2xl font-semibold text-zinc-900">
          Cobro rápido
        </h1>
        <p className="mb-4 text-sm text-zinc-500">
          Paciente, servicio (el precio se llena solo) y método. Listo.
        </p>
        <NuevoCobro
          pacientes={pacientes}
          servicios={servicios}
          productos={productos}
        />
        <Link
          href="/servicios"
          className="mt-3 inline-block text-sm text-zinc-500 hover:text-zinc-900"
        >
          Administrar servicios y precios →
        </Link>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-medium text-zinc-900">
          Cobros recientes
        </h2>
        <div className="overflow-hidden rounded-xl bg-white ring-1 ring-zinc-200">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-zinc-100">
              {cobros.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-800">
                      {c.pacientes
                        ? `${c.pacientes.nombre} ${c.pacientes.apellidos ?? ""}`
                        : "—"}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {fechaSinaloa(c.fecha)}
                      {c.cobro_pagos?.[0]?.metodo
                        ? ` · ${c.cobro_pagos[0].metodo}`
                        : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-zinc-900">
                    {fmt(c.total)}
                  </td>
                </tr>
              ))}
              {cobros.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-center text-zinc-400">
                    Sin cobros aún.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
