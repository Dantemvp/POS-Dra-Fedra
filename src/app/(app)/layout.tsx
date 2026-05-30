import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import LogoutButton from "@/components/LogoutButton";

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
        <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-3">
          <div />
          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-700">{usuario.nombre}</span>
            <LogoutButton />
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
