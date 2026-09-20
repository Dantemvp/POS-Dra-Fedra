"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { Rol } from "@/lib/auth";
import AreaNavigation from "@/components/AreaNavigation";
import { APP_VERSION } from "@/lib/version";

export default function Sidebar({ rol }: { rol: Rol }) {
  const [plegado, setPlegado] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setPlegado(window.localStorage.getItem("fedra-sidebar-plegado") === "1");
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function alternar() {
    setPlegado((actual) => {
      const siguiente = !actual;
      window.localStorage.setItem("fedra-sidebar-plegado", siguiente ? "1" : "0");
      return siguiente;
    });
  }

  return (
    <aside
      className={`relative z-[2] hidden shrink-0 flex-col border-r border-black/5 bg-white transition-[width] duration-200 print:hidden md:flex ${
        plegado ? "w-14" : "w-64"
      }`}
    >
      <button
        type="button"
        onClick={alternar}
        aria-label={plegado ? "Mostrar menú lateral" : "Guardar menú lateral"}
        aria-expanded={!plegado}
        className="absolute -right-3 top-7 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-black/10 bg-white text-sm font-semibold text-[#3f5148] shadow-sm transition hover:scale-105 hover:bg-[#f2eeec] focus:outline-none focus:ring-2 focus:ring-[#8c7a63]"
        title={plegado ? "Mostrar menú" : "Guardar menú"}
      >
        {plegado ? "›" : "‹"}
      </button>

      {plegado ? (
        <div className="flex flex-1 items-start justify-center pt-20">
          <span className="[writing-mode:vertical-rl] rotate-180 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
            Sistema Fedra
          </span>
        </div>
      ) : (
        <>
          <div className="px-6 pb-5 pt-6">
            <Image src="/logo.png" alt="Dra. Fedra Aldama" width={760} height={117} priority className="h-auto w-full max-w-[190px]" />
            <p className="mt-0.5 text-xs capitalize text-zinc-500">{rol}</p>
          </div>
          <AreaNavigation rol={rol} />
          <div className="mt-auto border-t border-black/5 px-6 py-3 text-[11px] text-zinc-400">
            Sistema Fedra · v{APP_VERSION}
          </div>
        </>
      )}
    </aside>
  );
}
