"use client";

import { usePathname, useSearchParams } from "next/navigation";
import type { Rol } from "@/lib/auth";
import { areaDeRuta, areaInicialParaRol, areasParaRol, type AreaTrabajo } from "@/components/nav";

const CONTENIDO: Record<AreaTrabajo, { titulo: string; detalle: string; clase: string; icono: string }> = {
  farmacia: {
    titulo: "Farmacia",
    detalle: "Ventas, inventario y caja",
    clase: "border-[#3f5148]/20 bg-[#e9efeb] text-[#314239] dark:bg-[#25342d] dark:text-[#e3eee7]",
    icono: "+",
  },
  consultorio: {
    titulo: "Consultorio",
    detalle: "Pacientes, recetas y cobros",
    clase: "border-[#8c6f6b]/20 bg-[#f3e9e7] text-[#6f514e] dark:bg-[#392b2a] dark:text-[#f1dedb]",
    icono: "♡",
  },
};

export default function AreaStatus({ rol, compacto = false }: { rol: Rol; compacto?: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const areas = areasParaRol(rol);
  const solicitada = searchParams.get("area") as AreaTrabajo | null;
  const area = areaDeRuta(pathname)
    ?? (solicitada && areas.includes(solicitada) ? solicitada : null)
    ?? areaInicialParaRol(rol);
  const contenido = CONTENIDO[area];

  return (
    <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 ${contenido.clase}`} aria-label={`Área actual: ${contenido.titulo}`}>
      <span aria-hidden="true" className="text-base font-bold leading-none">{contenido.icono}</span>
      <span className="text-xs font-bold uppercase tracking-[0.12em]">{contenido.titulo}</span>
      {!compacto && <span className="hidden text-xs opacity-75 xl:inline">· {contenido.detalle}</span>}
    </div>
  );
}
