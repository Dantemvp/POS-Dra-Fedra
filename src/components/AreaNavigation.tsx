"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { Rol } from "@/lib/auth";
import {
  areaInicialParaRol,
  areaDeRuta,
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

function NavLink({ item, pathname, area, onNavigate }: { item: NavItem; pathname: string; area: AreaTrabajo; onNavigate?: () => void }) {
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
  return (
    <Link
      href={areaDeRuta(item.href) ? item.href : `${item.href}?area=${area}`}
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
        <div className="mx-3 mb-5 grid grid-cols-2 gap-1 rounded-2xl bg-zinc-100 p-1.5 ring-1 ring-black/5" aria-label="Área de trabajo">
          {areas.map((area) => (
            <Link
              key={area}
              href={`/dashboard?area=${area}`}
              onClick={onNavigate}
              className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-2 py-2 text-center text-xs font-bold transition ${areaActiva === area
                ? area === "farmacia"
                  ? "bg-[#3f5148] text-white shadow-sm"
                  : "bg-[#8c6f6b] text-white shadow-sm"
                : "text-zinc-600 hover:bg-white hover:text-zinc-900"}`}
            >
              <span aria-hidden="true" className="text-base leading-none">{area === "farmacia" ? "+" : "♡"}</span>
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
              {grupo.items.map((item) => <NavLink key={item.href} item={item} pathname={pathname} area={areaActiva} onNavigate={onNavigate} />)}
            </div>
          </section>
        ) : null)}
      </nav>
    </>
  );
}
