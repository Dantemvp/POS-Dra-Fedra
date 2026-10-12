"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Rol } from "@/lib/auth";
import {
  ETIQUETA_AREA,
  areasParaRol,
  navParaRol,
  type AreaTrabajo,
  type GrupoNav,
  type NavItem,
} from "@/components/nav";
import { AreaIcon, useAreaTrabajo } from "@/components/AreaIdentity";

function NavLink({ item, pathname, area, onNavigate }: { item: NavItem; pathname: string; area: AreaTrabajo; onNavigate?: () => void }) {
  const otraSubvista = (item.href === '/cobros' && pathname.startsWith('/cobros/corte')) || (item.href === '/cortes' && pathname.startsWith('/cortes/resumen'));
  const active = pathname === item.href || (!otraSubvista && pathname.startsWith(`${item.href}/`));
  return (
    <Link
      href={item.grupo === 'general' || item.grupo === 'gestion' ? `${item.href}?area=${area}` : item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${active ? "fedra-nav-active font-medium shadow-sm" : "text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900"}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-[#d9c7a7]" : "bg-zinc-300 group-hover:bg-[#8c7a63]"}`} />
      {item.label}
    </Link>
  );
}

export default function AreaNavigation({ rol, onNavigate }: { rol: Rol; onNavigate?: () => void }) {
  const pathname = usePathname();
  const areas = areasParaRol(rol);
  const areaActiva = useAreaTrabajo(rol);
  const items = navParaRol(rol);
  const grupos: { id: GrupoNav; titulo: string; items: NavItem[] }[] = [
    { id: "general", titulo: "General", items: items.filter((item) => item.grupo === "general") },
    { id: areaActiva, titulo: ETIQUETA_AREA[areaActiva], items: items.filter((item) => item.grupo === areaActiva) },
    { id: "gestion", titulo: "Gestión", items: items.filter((item) => item.grupo === "gestion") },
  ];

  return (
    <>
      {areas.length > 1 && (
        <div className="fedra-area-switch mx-3 mb-4 grid grid-cols-2 gap-2 rounded-xl p-1.5" aria-label="Cambiar área de trabajo">
          {areas.map((area) => (
            <Link
              key={area}
              href={`/dashboard?area=${area}`}
              onClick={onNavigate}
              data-area={area}
              aria-current={areaActiva === area ? "true" : undefined}
              aria-label={`${ETIQUETA_AREA[area]}${areaActiva === area ? ', área activa' : ', cambiar área'}`}
              className={`fedra-area-option flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-center text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${areaActiva === area ? "fedra-area-selected" : "fedra-area-idle"}`}
            >
              <span className="flex items-center gap-1.5"><AreaIcon area={area} />{ETIQUETA_AREA[area]}</span>
              <span className="text-[10px] font-medium">{areaActiva === area ? '✓ Activa' : 'Cambiar área'}</span>
            </Link>
          ))}
        </div>
      )}
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-3">
        {grupos.map((grupo) => grupo.items.length > 0 ? (
          <section key={grupo.id}>
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">{grupo.titulo}</p>
            <div className="space-y-1">
              {grupo.items.map((item) => <NavLink key={item.href} item={item} pathname={pathname} area={areaActiva} onNavigate={onNavigate} />)}
            </div>
          </section>
        ) : null)}
      </nav>
    </>
  );
}
