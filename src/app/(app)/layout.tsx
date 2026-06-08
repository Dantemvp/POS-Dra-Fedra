import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import MobileTopBar from "@/components/MobileTopBar";
import LogoutButton from "@/components/LogoutButton";
import ThemeToggle from "@/components/ThemeToggle";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await getUsuarioActual();
  if (!usuario) redirect("/login");

  return (
    <div className="flex min-h-screen bg-zinc-100">
      <Sidebar rol={usuario.rol} />
      <div className="flex flex-1 flex-col">
        {/* Móvil: barra con hamburguesa + menú deslizable */}
        <MobileTopBar rol={usuario.rol} nombre={usuario.nombre} />

        {/* Escritorio: header con usuario, tema y salir */}
        <header className="hidden items-center justify-between border-b border-zinc-200 bg-white px-6 py-3 print:hidden md:flex">
          <div />
          <div className="flex items-center gap-3">
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
