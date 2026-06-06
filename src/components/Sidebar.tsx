"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Rol } from "@/lib/auth";

type NavItem = {
  href: string;
  label: string;
  roles: Rol[];
  ready: boolean; // false = aún no construido (se muestra deshabilitado)
};

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Inicio", roles: ["admin", "farmacia", "doctora", "asistente"], ready: true },
  { href: "/inventario", label: "Inventario", roles: ["admin", "farmacia"], ready: true },
  { href: "/compras", label: "Compras", roles: ["admin", "farmacia"], ready: true },
  { href: "/ventas", label: "Punto de venta", roles: ["admin", "farmacia"], ready: true },
  { href: "/caja", label: "Caja y reportes", roles: ["admin", "farmacia"], ready: true },
  { href: "/pacientes", label: "Pacientes", roles: ["admin", "doctora", "asistente"], ready: true },
  { href: "/agenda", label: "Agenda", roles: ["admin", "doctora", "asistente"], ready: true },
  { href: "/recetas", label: "Recetas", roles: ["admin", "doctora"], ready: true },
  { href: "/cobros", label: "Cobros", roles: ["admin", "doctora", "asistente"], ready: true },
  { href: "/servicios", label: "Servicios", roles: ["admin", "doctora"], ready: true },
];

export default function Sidebar({ rol }: { rol: Rol }) {
  const pathname = usePathname();
  const items = NAV.filter((i) => i.roles.includes(rol));

  return (
    <aside className="flex w-56 flex-col border-r border-zinc-200 bg-white print:hidden">
      <div className="border-b border-zinc-200 px-5 py-4">
        <p className="text-sm font-semibold text-zinc-900">Dra. Fedra Aldama</p>
        <p className="text-xs text-zinc-500 capitalize">{rol}</p>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          if (!item.ready) {
            return (
              <span
                key={item.href}
                className="flex cursor-not-allowed items-center justify-between rounded-lg px-3 py-2 text-sm text-zinc-400"
              >
                {item.label}
                <span className="text-[10px] uppercase tracking-wide">pronto</span>
              </span>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-lg px-3 py-2 text-sm transition ${
                active
                  ? "bg-zinc-900 font-medium text-white"
                  : "text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
