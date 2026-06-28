"use client";

import { useMemo, useState, useTransition } from "react";
import { cobrar } from "./actions";
import BarcodeInput from "@/components/BarcodeInput";
import { FISCAL_FARMACIA, leyendaFacturacion } from "@/lib/fiscal";

type Producto = {
  id: string;
  nombre: string;
  precio: number;
  stock: number;
  requiere_receta: boolean;
  codigo_barras: string | null;
};

type Linea = { producto_id: string; nombre: string; precio: number; cantidad: number; stock: number };

const money = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

type Ticket = {
  folio?: number;
  lineas: Linea[];
  total: number;
  metodo: string;
  fecha: string;
};

export default function POS({
  productos,
  vendedor,
}: {
  productos: Producto[];
  vendedor: string;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [carrito, setCarrito] = useState<Linea[]>([]);
  const [metodo, setMetodo] = useState("efectivo");
  const [error, setError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [pending, startTransition] = useTransition();

  function onScan(code: string) {
    const p = productos.find((x) => x.codigo_barras === code);
    if (!p) {
      setError(`Código ${code} no está ligado a ningún producto.`);
      return;
    }
    agregar(p);
  }

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const base = q
      ? productos.filter((p) => p.nombre.toLowerCase().includes(q))
      : productos;
    return base.slice(0, 8);
  }, [busqueda, productos]);

  const total = carrito.reduce((s, l) => s + l.precio * l.cantidad, 0);

  function agregar(p: Producto) {
    setError(null);
    if (p.stock <= 0) {
      setError(`"${p.nombre}" no tiene stock.`);
      return;
    }
    setCarrito((prev) => {
      const ex = prev.find((l) => l.producto_id === p.id);
      if (ex) {
        if (ex.cantidad >= p.stock) return prev;
        return prev.map((l) =>
          l.producto_id === p.id ? { ...l, cantidad: l.cantidad + 1 } : l,
        );
      }
      return [
        ...prev,
        { producto_id: p.id, nombre: p.nombre, precio: p.precio, cantidad: 1, stock: p.stock },
      ];
    });
  }

  function cambiarCantidad(id: string, delta: number) {
    setCarrito((prev) =>
      prev
        .map((l) => {
          if (l.producto_id !== id) return l;
          const nueva = Math.max(0, Math.min(l.stock, l.cantidad + delta));
          return { ...l, cantidad: nueva };
        })
        .filter((l) => l.cantidad > 0),
    );
  }

  function quitar(id: string) {
    setCarrito((prev) => prev.filter((l) => l.producto_id !== id));
  }

  function finalizar() {
    setError(null);
    if (carrito.length === 0) return;
    const snapshot = carrito;
    const metodoSel = metodo;
    startTransition(async () => {
      const res = await cobrar(
        snapshot.map((l) => ({
          producto_id: l.producto_id,
          cantidad: l.cantidad,
          precio_unit: l.precio,
        })),
        metodoSel,
      );
      if (!res.ok) {
        setError(res.error ?? "No se pudo cobrar.");
        return;
      }
      setTicket({
        folio: res.folio,
        lineas: snapshot,
        total: snapshot.reduce((s, l) => s + l.precio * l.cantidad, 0),
        metodo: metodoSel,
        fecha: new Date().toLocaleString("es-MX"),
      });
      setCarrito([]);
    });
  }

  if (ticket) {
    return (
      <div className="mx-auto max-w-sm">
        <div className="doc-imprimible rounded-xl bg-white p-6 ring-1 ring-zinc-200 print:shadow-none print:ring-0">
          <div className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-farmacia.png"
              alt={FISCAL_FARMACIA.nombreComercial}
              className="mx-auto h-12 w-auto object-contain"
            />
          </div>
          <div className="my-3 border-t border-dashed border-zinc-300" />
          <p className="text-xs text-zinc-500">
            Folio #{ticket.folio} · {ticket.fecha}
          </p>
          {vendedor && (
            <p className="text-xs text-zinc-500">Atendió: {vendedor}</p>
          )}
          <table className="mt-3 w-full text-sm">
            <tbody>
              {ticket.lineas.map((l) => (
                <tr key={l.producto_id}>
                  <td className="py-1">
                    {l.cantidad} × {l.nombre}
                  </td>
                  <td className="py-1 text-right tabular-nums">
                    {money(l.precio * l.cantidad)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="my-3 border-t border-dashed border-zinc-300" />
          <div className="flex justify-between font-semibold text-zinc-900">
            <span>Total</span>
            <span className="tabular-nums">{money(ticket.total)}</span>
          </div>
          <p className="mt-1 text-right text-xs capitalize text-zinc-500">
            {ticket.metodo}
          </p>

          <div className="my-3 border-t border-dashed border-zinc-300" />
          <div className="space-y-0.5 text-center text-[10px] leading-tight text-zinc-500">
            <p className="font-medium text-zinc-700">
              {FISCAL_FARMACIA.razonSocial}
            </p>
            <p>RFC: {FISCAL_FARMACIA.rfc}</p>
            <p>
              {FISCAL_FARMACIA.domicilio}, C.P. {FISCAL_FARMACIA.cp},{" "}
              {FISCAL_FARMACIA.ciudad}
            </p>
          </div>
          <p className="mt-2 text-center text-[10px] leading-snug text-zinc-500">
            {leyendaFacturacion()}
          </p>
        </div>
        <div className="mt-4 flex gap-2 print:hidden">
          <button
            onClick={() => window.print()}
            className="flex-1 rounded-lg border border-zinc-300 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Imprimir ticket
          </button>
          <button
            onClick={() => setTicket(null)}
            className="flex-1 rounded-lg bg-zinc-900 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Nueva venta
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Productos */}
      <div className="rounded-xl bg-white p-4 ring-1 ring-zinc-200">
        <div className="mb-2">
          <BarcodeInput onScan={onScan} />
        </div>
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="…o busca producto por nombre"
          className="mb-3 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-900"
        />
        <div className="space-y-1">
          {filtrados.length === 0 && (
            <p className="py-6 text-center text-sm text-zinc-400">
              Sin productos.
            </p>
          )}
          {filtrados.map((p) => (
            <button
              key={p.id}
              onClick={() => agregar(p)}
              disabled={p.stock <= 0}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition hover:bg-zinc-100 disabled:opacity-40"
            >
              <span className="font-medium text-zinc-900">{p.nombre}</span>
              <span className="flex items-center gap-3">
                <span className="text-xs text-zinc-400">stock {p.stock}</span>
                <span className="tabular-nums text-zinc-700">{money(p.precio)}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Carrito */}
      <div className="rounded-xl bg-white p-4 ring-1 ring-zinc-200">
        <h2 className="mb-3 font-medium text-zinc-900">Carrito</h2>
        {carrito.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-400">
            Agrega productos desde la izquierda.
          </p>
        ) : (
          <div className="space-y-2">
            {carrito.map((l) => (
              <div
                key={l.producto_id}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="flex-1 truncate text-zinc-900">{l.nombre}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => cambiarCantidad(l.producto_id, -1)} className="h-6 w-6 rounded bg-zinc-100 text-zinc-700 hover:bg-zinc-200">−</button>
                  <span className="w-6 text-center tabular-nums">{l.cantidad}</span>
                  <button onClick={() => cambiarCantidad(l.producto_id, 1)} className="h-6 w-6 rounded bg-zinc-100 text-zinc-700 hover:bg-zinc-200">+</button>
                </div>
                <span className="w-20 text-right tabular-nums text-zinc-700">
                  {money(l.precio * l.cantidad)}
                </span>
                <button onClick={() => quitar(l.producto_id)} className="text-zinc-300 hover:text-red-500">✕</button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 border-t border-zinc-200 pt-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-zinc-500">Total</span>
            <span className="text-xl font-semibold tabular-nums text-zinc-900">
              {money(total)}
            </span>
          </div>
          <label className="mb-1 block text-xs font-medium text-zinc-600">
            Método de pago
          </label>
          <select
            value={metodo}
            onChange={(e) => setMetodo(e.target.value)}
            className="mb-3 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
          >
            <option value="efectivo">Efectivo</option>
            <option value="tarjeta">Tarjeta</option>
            <option value="transferencia">Transferencia</option>
            <option value="otro">Otro</option>
          </select>

          {error && (
            <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            onClick={finalizar}
            disabled={carrito.length === 0 || pending}
            className="w-full rounded-lg bg-zinc-900 py-2.5 font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50"
          >
            {pending ? "Cobrando…" : `Cobrar ${money(total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
