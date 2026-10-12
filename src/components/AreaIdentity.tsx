"use client";

import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import type { Rol } from "@/lib/auth";
import { areaParaVista, ETIQUETA_AREA, MARCA_AREA, type AreaTrabajo } from "@/components/nav";

export function useAreaTrabajo(rol: Rol) {
  return areaParaVista(rol, usePathname(), useSearchParams().get("area"));
}

export function AreaIcon({ area }: { area: AreaTrabajo }) {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      {area === "farmacia"
        ? <><path d="m9 15 6-6M6 18a5 5 0 0 1 0-7l5-5a5 5 0 0 1 7 7l-5 5a5 5 0 0 1-7 0Z" /></>
        : <><path d="M6 3v6a4 4 0 0 0 8 0V3M4 3h4m4 0h4M10 13v3a5 5 0 0 0 10 0v-2" /><circle cx="20" cy="11" r="2" /></>}
    </svg>
  );
}

export function AreaIndicator({ rol }: { rol: Rol }) {
  const area = useAreaTrabajo(rol);
  const pathname = usePathname();
  const gestion = ["/cortes", "/movimientos", "/usuarios"].some((ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`));
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2" aria-label={`Área de navegación: ${ETIQUETA_AREA[area]}`}>
      <span className="fedra-area-indicator inline-flex min-h-9 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-bold" data-area={area}>
        <AreaIcon area={area} /> {ETIQUETA_AREA[area]}
      </span>
      <span className="text-xs text-zinc-600">{gestion ? "Gestión compartida" : "Área activa"}</span>
    </div>
  );
}

export function AreaBrand({ rol, compact = false }: { rol: Rol; compact?: boolean }) {
  const area = useAreaTrabajo(rol);
  const marca = MARCA_AREA[area];
  return (
    <div className={`flex items-center justify-center ${compact ? "h-10 w-32 sm:w-40" : "h-16 w-full"}`}>
      <Image src={marca.src} alt={marca.alt} width={marca.width} height={marca.height} priority className={`${area === "farmacia" ? "fedra-pharmacy-logo rounded-md bg-[#fff] p-1" : "fedra-brand-logo"} h-auto max-h-full w-auto max-w-full object-contain`} />
    </div>
  );
}
