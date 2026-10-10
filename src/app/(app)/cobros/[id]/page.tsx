import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth";
import { fechaSinaloa } from "@/lib/tz";
import { GOOGLE_REVIEW_URL } from "@/lib/fiscal";
import PrintControls from "@/components/PrintControls";

type Comprobante = {
  id: string; fecha: string; total: number; estado: string | null; nota: string | null;
  pacientes: { nombre: string; apellidos: string | null } | null;
  cobro_items: { id: string; descripcion: string; cantidad: number; precio_unit: number; subtotal: number }[];
  cobro_pagos: { id: string; metodo: string; monto: number }[];
};
const money = (valor: number) => Number(valor).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export default async function TicketCobro({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ imprimir?: string }>;
}) {
  const usuario = await getUsuarioActual();
  if (!usuario) redirect("/login");
  if (usuario.rol === "farmacia") notFound();
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.from("cobros").select(
    "id, fecha, total, estado, nota, pacientes(nombre, apellidos), cobro_items(id, descripcion, cantidad, precio_unit, subtotal), cobro_pagos(id, metodo, monto)",
  ).eq("id", id).single();
  if (error || !data) notFound();
  const cobro = data as unknown as Comprobante;
  return <div className="mx-auto max-w-sm">
    <style>{`@media print {
      @page { size: 80mm auto; margin: 0; }
      html, body, main { margin: 0 !important; padding: 0 !important; background: white !important; }
      .ticket-print section { break-inside: avoid; }
    }`}</style>
    <div className="print-area ticket-print ticket-thermal-strong rounded-xl bg-white p-5 text-black ring-1 ring-zinc-200">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="Dra. Fedra Aldama" className="ticket-logo mx-auto mb-4 h-auto w-full" />
      <p className="text-sm font-bold">Consultorio · Comprobante de cobro</p>
      <p className="break-all text-xs font-bold">Referencia: {cobro.id}</p>
      <p className="text-sm font-bold">{fechaSinaloa(cobro.fecha)}</p>
      {cobro.estado === "cancelado" && <p className="text-lg font-bold">CANCELADO</p>}
      <p className="mt-2 font-semibold">{cobro.pacientes ? `${cobro.pacientes.nombre} ${cobro.pacientes.apellidos ?? ""}` : "Cliente"}</p>
      <div className="my-3 border-t border-dashed border-black" />
      {cobro.cobro_items.map(item => <section key={item.id} className="mb-2 flex justify-between gap-2 text-sm font-semibold">
        <span>{item.cantidad} × {item.descripcion}<small className="block">{money(item.precio_unit)} c/u</small></span>
        <span className="shrink-0">{money(item.subtotal)}</span>
      </section>)}
      <div className="my-3 flex justify-between border-t border-dashed border-black pt-3 text-lg font-bold"><span>Total</span><span>{money(cobro.total)}</span></div>
      {cobro.cobro_pagos.map(pago => <p key={pago.id} className="flex justify-between text-sm font-bold"><span className="capitalize">{pago.metodo}</span><span>{money(pago.monto)}</span></p>)}
      {cobro.nota && <p className="mt-3 whitespace-pre-wrap text-sm font-semibold">Nota: {cobro.nota}</p>}
      <section className="mt-4 flex flex-col items-center border-t border-dashed border-black pt-3">
        <QRCodeSVG value={GOOGLE_REVIEW_URL} size={96} marginSize={2} fgColor="#000000" bgColor="#ffffff" />
        <p className="mt-2 text-center text-sm font-bold">Escanea y déjanos tu reseña en Google.</p>
      </section>
    </div>
    <div className="mt-4 space-y-3 print:hidden"><PrintControls automatico={query.imprimir === "1"} /><Link href="/cobros" className="block">Volver a cobros</Link></div>
  </div>;
}
