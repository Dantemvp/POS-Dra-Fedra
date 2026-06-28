"use client";

import { useState } from "react";
import CancelarVentaBtn from "./CancelarVentaBtn";

const money = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export type VentaItem = { nombre: string; cantidad: number; precio_unit: number };
export type VentaPago = { metodo: string; monto: number };
export type VentaDetalle = {
  id: string;
  folio: number;
  hora: string;
  total: number;
  metodo_pago: string | null;
  items: VentaItem[];
  pagos: VentaPago[];
};

export default function VentasDelDia({ ventas }: { ventas: VentaDetalle[] }) {
  const [abierta, setAbierta] = useState<string | null>(null);

  return (
    <div className="overflow-hidden rounded-xl bg-white ring-1 ring-zinc-200">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500">
          <tr>
            <th className="px-4 py-3">Folio</th>
            <th className="px-4 py-3">Hora</th>
            <th className="px-4 py-3">Método</th>
            <th className="px-4 py-3 text-right">Total</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {ventas.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-zinc-400">
                Sin ventas hoy.
              </td>
            </tr>
          )}
          {ventas.map((v) => {
            const expandida = abierta === v.id;
            // Con pagos mixtos hay varias filas en `pagos`; si no, cae al metodo_pago.
            const metodoLabel =
              v.pagos.length > 1
                ? "Mixto"
                : (v.pagos[0]?.metodo ?? v.metodo_pago ?? "—");
            return (
              <FilaVenta
                key={v.id}
                venta={v}
                expandida={expandida}
                metodoLabel={metodoLabel}
                onToggle={() => setAbierta(expandida ? null : v.id)}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FilaVenta({
  venta: v,
  expandida,
  metodoLabel,
  onToggle,
}: {
  venta: VentaDetalle;
  expandida: boolean;
  metodoLabel: string;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="hover:bg-zinc-50">
        <td className="px-4 py-3 font-medium text-zinc-900">
          <button
            onClick={onToggle}
            className="flex items-center gap-1.5 hover:text-zinc-600"
            aria-expanded={expandida}
          >
            <span
              className={`inline-block text-zinc-400 transition-transform ${
                expandida ? "rotate-90" : ""
              }`}
            >
              ›
            </span>
            #{v.folio}
          </button>
        </td>
        <td className="px-4 py-3 text-zinc-600">{v.hora}</td>
        <td className="px-4 py-3 capitalize text-zinc-600">{metodoLabel}</td>
        <td className="px-4 py-3 text-right tabular-nums text-zinc-900">
          {money(Number(v.total))}
        </td>
        <td className="px-4 py-3 text-right">
          <CancelarVentaBtn ventaId={v.id} />
        </td>
      </tr>
      {expandida && (
        <tr className="bg-zinc-50/60">
          <td colSpan={5} className="px-4 py-3">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-medium uppercase text-zinc-500">
                  Productos
                </p>
                <ul className="space-y-1">
                  {v.items.length === 0 ? (
                    <li className="text-sm text-zinc-400">Sin detalle.</li>
                  ) : (
                    v.items.map((it, i) => (
                      <li
                        key={i}
                        className="flex justify-between gap-3 text-sm text-zinc-700"
                      >
                        <span>
                          {it.cantidad} × {it.nombre}
                        </span>
                        <span className="tabular-nums text-zinc-500">
                          {money(it.cantidad * it.precio_unit)}
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium uppercase text-zinc-500">
                  Pago
                </p>
                <ul className="space-y-1">
                  {v.pagos.length === 0 ? (
                    <li className="text-sm capitalize text-zinc-700">
                      {v.metodo_pago ?? "—"}
                    </li>
                  ) : (
                    v.pagos.map((p, i) => (
                      <li
                        key={i}
                        className="flex justify-between gap-3 text-sm text-zinc-700"
                      >
                        <span className="capitalize">{p.metodo}</span>
                        <span className="tabular-nums text-zinc-500">
                          {money(Number(p.monto))}
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
