"use client";

import { useEffect, useState, useTransition } from "react";
import { registrarCompra, type ItemCompra } from "./actions";

const input =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900";
const label = "mb-1 block text-xs font-medium text-zinc-600";

const filaVacia: ItemCompra = {
  producto_id: "",
  cantidad: "",
  costo: "",
  lote: "",
  caducidad: "",
};

export default function NuevaCompra({
  productos,
}: {
  productos: { id: string; nombre: string }[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [proveedor, setProveedor] = useState("");
  const [factura, setFactura] = useState("");
  const [fecha, setFecha] = useState("");
  const [items, setItems] = useState<ItemCompra[]>([{ ...filaVacia }]);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, startTransition] = useTransition();

  // El aviso de éxito se borra solo a los 3 segundos.
  useEffect(() => {
    if (!ok) return;
    const t = setTimeout(() => setOk(false), 3000);
    return () => clearTimeout(t);
  }, [ok]);

  function setItem(idx: number, patch: Partial<ItemCompra>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function guardar() {
    setMsg(null);
    setOk(false);
    startTransition(async () => {
      const res = await registrarCompra(proveedor, factura, fecha, items);
      if (!res.ok) {
        setMsg(res.error ?? "Error.");
        return;
      }
      setOk(true);
      setProveedor("");
      setFactura("");
      setFecha("");
      setItems([{ ...filaVacia }]);
    });
  }

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="mb-6 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
      >
        + Registrar compra
      </button>
    );
  }

  return (
    <div className="mb-6 rounded-xl bg-white p-5 ring-1 ring-zinc-200">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className={label}>Proveedor</label>
          <input
            className={input}
            value={proveedor}
            onChange={(e) => setProveedor(e.target.value)}
            placeholder="Nombre del proveedor"
          />
        </div>
        <div>
          <label className={label}>Factura</label>
          <input
            className={input}
            value={factura}
            onChange={(e) => setFactura(e.target.value)}
          />
        </div>
        <div>
          <label className={label}>Fecha</label>
          <input
            type="date"
            className={input}
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <p className="text-xs font-medium uppercase text-zinc-500">Productos</p>
        {items.map((it, idx) => (
          <div
            key={idx}
            className="grid grid-cols-1 gap-2 rounded-lg bg-zinc-50 p-3 sm:grid-cols-12"
          >
            <select
              className={`${input} sm:col-span-4`}
              value={it.producto_id}
              onChange={(e) => setItem(idx, { producto_id: e.target.value })}
            >
              <option value="">Producto…</option>
              {productos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
            <input
              className={`${input} sm:col-span-2`}
              type="number"
              min="1"
              placeholder="Cantidad"
              value={it.cantidad}
              onChange={(e) => setItem(idx, { cantidad: e.target.value })}
            />
            <input
              className={`${input} sm:col-span-2`}
              type="number"
              step="0.01"
              placeholder="Costo unit."
              value={it.costo}
              onChange={(e) => setItem(idx, { costo: e.target.value })}
            />
            <input
              className={`${input} sm:col-span-2`}
              placeholder="Lote"
              value={it.lote}
              onChange={(e) => setItem(idx, { lote: e.target.value })}
            />
            <input
              className={`${input} sm:col-span-2`}
              type="date"
              value={it.caducidad}
              onChange={(e) => setItem(idx, { caducidad: e.target.value })}
            />
          </div>
        ))}
        <button
          onClick={() => setItems((p) => [...p, { ...filaVacia }])}
          className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
        >
          + Agregar producto
        </button>
      </div>

      {msg && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {msg}
        </p>
      )}
      {ok && (
        <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          Compra registrada y sumada al inventario.
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <button
          onClick={guardar}
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Guardar compra"}
        </button>
        <button
          onClick={() => setAbierto(false)}
          className="rounded-lg px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
