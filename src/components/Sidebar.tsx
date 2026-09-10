import Image from "next/image";
import type { Rol } from "@/lib/auth";
import AreaNavigation from "@/components/AreaNavigation";
import { APP_VERSION } from "@/lib/version";

export default function Sidebar({ rol }: { rol: Rol }) {
  return (
    <aside className="relative z-[1] hidden w-64 flex-col border-r border-black/5 bg-white print:hidden md:flex">
      <div className="px-6 pb-5 pt-6">
        <Image src="/logo.png" alt="Dra. Fedra Aldama" width={760} height={117} priority className="h-auto w-full max-w-[190px]" />
        <p className="mt-0.5 text-xs capitalize text-zinc-500">{rol}</p>
      </div>
      <AreaNavigation rol={rol} />
      <div className="mt-auto border-t border-black/5 px-6 py-3 text-[11px] text-zinc-400">
        Sistema Fedra · v{APP_VERSION}
      </div>
    </aside>
  );
}
