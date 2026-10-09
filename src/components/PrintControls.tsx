"use client";

import AutoPrint from "./AutoPrint";

export default function PrintControls({ automatico = false }: { automatico?: boolean }) {
  return <div className="print:hidden">
    {automatico && <AutoPrint consumirSolicitud />}
    <button type="button" onClick={() => window.print()} className="rounded-xl bg-zinc-900 px-4 py-3 font-semibold text-white">Reimprimir ticket / PDF</button>
  </div>;
}
