import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import MobileTopBar from "@/components/MobileTopBar";
import LogoutButton from "@/components/LogoutButton";
import ThemeToggle from "@/components/ThemeToggle";
import { APP_VERSION } from "@/lib/version";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await getUsuarioActual();
  if (!usuario) redirect("/login");

  return (
    <div className="fedra-shell flex min-h-screen bg-[#f8f6f2]">
      <Sidebar rol={usuario.rol} />
      <div className="relative z-[1] flex flex-1 flex-col">
        {/* Móvil: barra con hamburguesa + menú deslizable */}
        <MobileTopBar rol={usuario.rol} nombre={usuario.nombre} />

        {/* Escritorio: header con usuario, tema y salir */}
        <header className="hidden items-center justify-between border-b border-black/5 bg-[#f8f6f2] px-6 py-3 print:hidden md:flex">
          <div />
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-500 ring-1 ring-black/5">
              v{APP_VERSION}
            </span>
            <span className="text-sm text-zinc-700">{usuario.nombre}</span>
            <ThemeToggle />
            <LogoutButton />
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
