"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { Rol } from "@/lib/auth";
import {
  areaInicialParaRol,
  areasParaRol,
  navParaRol,
  type AreaTrabajo,
  type GrupoNav,
  type NavItem,
} from "@/components/nav";

const ETIQUETA_AREA: Record<AreaTrabajo, string> = {
  farmacia: "Farmacia",
  consultorio: "Consultorio",
};

const RUTAS_AREA: Record<AreaTrabajo, string[]> = {
  farmacia: ["/ventas", "/inventario", "/compras", "/caja"],
  consultorio: ["/pacientes", "/agenda", "/recetas", "/cobros", "/servicios"],
};

function areaDeRuta(pathname: string): AreaTrabajo | null {
  for (const area of ["farmacia", "consultorio"] as const) {
    if (RUTAS_AREA[area].some((ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`))) return area;
  }
  return null;
}

function NavLink({ item, pathname, onNavigate }: { item: NavItem; pathname: string; onNavigate?: () => void }) {
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${active ? "bg-[#3f5148] font-medium text-white shadow-sm" : "text-zinc-700 hover:bg-[#f2eeec] hover:text-zinc-950"}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-[#d9c7a7]" : "bg-zinc-300 group-hover:bg-[#8c7a63]"}`} />
      {item.label}
    </Link>
  );
}

export default function AreaNavigation({ rol, onNavigate }: { rol: Rol; onNavigate?: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const areas = areasParaRol(rol);
  const solicitada = searchParams.get("area");
  const areaSolicitada = areas.includes(solicitada as AreaTrabajo) ? (solicitada as AreaTrabajo) : null;
  const areaActiva = areaDeRuta(pathname) ?? areaSolicitada ?? areaInicialParaRol(rol);
  const items = navParaRol(rol);
  const grupos: { id: GrupoNav; titulo: string; items: NavItem[] }[] = [
    { id: "general", titulo: "General", items: items.filter((item) => item.grupo === "general") },
    { id: areaActiva, titulo: ETIQUETA_AREA[areaActiva], items: items.filter((item) => item.grupo === areaActiva) },
    { id: "gestion", titulo: "Gestión", items: items.filter((item) => item.grupo === "gestion") },
  ];

  return (
    <>
      {areas.length > 1 && (
        <div className="mx-3 mb-4 grid grid-cols-2 rounded-xl bg-[#f2eeec] p-1" aria-label="Área de trabajo">
          {areas.map((area) => (
            <Link
              key={area}
              href={`/dashboard?area=${area}`}
              onClick={onNavigate}
              className={`rounded-lg px-2 py-2 text-center text-xs font-semibold transition ${areaActiva === area ? "bg-white text-[#3f5148] shadow-sm ring-1 ring-black/5" : "text-[#756a5c] hover:text-zinc-900"}`}
            >
              {ETIQUETA_AREA[area]}
            </Link>
          ))}
        </div>
      )}
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-3">
        {grupos.map((grupo) => grupo.items.length > 0 ? (
          <section key={grupo.id}>
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">{grupo.titulo}</p>
            <div className="space-y-1">
              {grupo.items.map((item) => <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />)}
            </div>
          </section>
        ) : null)}
      </nav>
    </>
  );
}
