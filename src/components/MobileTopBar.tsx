"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Rol } from "@/lib/auth";
import { navParaRol } from "@/components/nav";
import ThemeToggle from "@/components/ThemeToggle";
import LogoutButton from "@/components/LogoutButton";

// Barra superior + menú lateral deslizable. Solo se muestra en pantallas
// chicas (md:hidden); en escritorio manda el Sidebar fijo.
export default function MobileTopBar({
  rol,
  nombre,
}: {
  rol: Rol;
  nombre: string;
}) {
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);
  const items = navParaRol(rol);

  // Bloquea el scroll del fondo cuando el menú está abierto.
  useEffect(() => {
    document.body.style.overflow = abierto ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [abierto]);

  return (
    <div className="md:hidden print:hidden">
      {/* Barra superior */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-zinc-200 bg-white px-3 py-2.5">
        <button
          onClick={() => setAbierto(true)}
          aria-label="Abrir menú"
          className="rounded-lg p-2 text-zinc-700 hover:bg-zinc-100"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-zinc-900">Dra. Fedra Aldama</span>
        <ThemeToggle />
      </header>

      {/* Overlay + drawer */}
      {abierto && (
        <div className="fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setAbierto(false)}
          />
          <aside className="absolute left-0 top-0 flex h-full w-72 max-w-[82%] flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-zinc-900">{nombre}</p>
                <p className="text-xs text-zinc-500 capitalize">{rol}</p>
              </div>
              <button
                onClick={() => setAbierto(false)}
                aria-label="Cerrar menú"
                className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto p-3">
              {items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    onClick={() => setAbierto(false)}
                    href={item.href}
                    className={`block rounded-lg px-3 py-2.5 text-[15px] transition ${
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

            <div className="border-t border-zinc-200 px-3 py-3">
              <LogoutButton />
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
