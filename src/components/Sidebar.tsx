import type { Rol } from "@/lib/auth";
import { APP_VERSION } from "@/lib/version";
import AreaNavigation from "@/components/AreaNavigation";

export default function Sidebar({ rol }: { rol: Rol }) {
  return (
    <aside className="hidden w-64 flex-col border-r border-black/5 bg-white print:hidden md:flex">
      <div className="px-6 pb-5 pt-6">
        <p className="font-semibold tracking-[-0.01em] text-zinc-900">Dra. Fedra Aldama</p>
        <p className="mt-0.5 text-xs capitalize text-zinc-500">{rol}</p>
      </div>
      <AreaNavigation rol={rol} />
      <div className="border-t border-zinc-200 px-5 py-3 text-[10px] text-zinc-400">
        {APP_VERSION.etiqueta}
      </div>
    </aside>
  );
}
