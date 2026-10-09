"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle({ compacto = false }: { compacto?: boolean }) {
  const [oscuro, setOscuro] = useState(false);

  useEffect(() => {
    // Sincroniza el icono con el tema que el script anti-parpadeo ya aplicó.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOscuro(document.documentElement.classList.contains("dark"));
  }, []);

  function alternar() {
    const nuevo = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", nuevo);
    try {
      localStorage.setItem("tema", nuevo ? "dark" : "light");
    } catch {}
    setOscuro(nuevo);
  }

  return (
    <button
      onClick={alternar}
      aria-label={oscuro ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
      title={oscuro ? "Tema claro" : "Tema oscuro"}
      className="flex min-h-10 items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-2 text-zinc-700 shadow-sm transition hover:border-[#8c7a63] hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#8c7a63]/40"
    >
      {oscuro ? (
        // Sol
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        // Luna
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
      {!compacto && <span className="text-xs font-semibold">{oscuro ? "Tema claro" : "Tema oscuro"}</span>}
    </button>
  );
}
