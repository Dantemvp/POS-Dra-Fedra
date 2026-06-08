"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import BarcodeInput from "@/components/BarcodeInput";
import { crearCobro, type ItemCobro } from "./actions";

export type Paciente = { id: string; nombre: string };
export type Servicio = { id: string; nombre: string; precio: number };
export type Producto = {
  id: string;
  nombre: string;
  precio: number;
  stock: number;
  codigo_barras: string | null;
};

type Metodo = "transferencia" | "efectivo" | "tarjeta" | "otro";

export default function NuevoCobro({
  pacientes,
  servicios,
  productos,
}: {
  pacientes: Paciente[];
  servicios: Servicio[];
  productos: Producto[];
}) {
  const router = useRouter();
  const [pacienteId, setPacienteId] = useState("");
  const [items, setItems] = useState<ItemCobro[]>([]);
  const [metodo, setMetodo] = useState<Metodo>("transferencia");
  const [nota, setNota] = useState("");
  const [busca, setBusca] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  const total = useMemo(
    () => items.reduce((s, i) => s + (i.precio_unit || 0) * (i.cantidad || 1), 0),
    [items],
  );

  function setItem(i: number, patch: Partial<ItemCobro>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function quitar(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  // --- Productos por código de barras (BIP) o búsqueda ---
  function agregarProducto(p: Producto) {
    setError("");
    setItems((prev) => {
      const idx = prev.findIndex((it) => it.producto_id === p.id);
      if (idx >= 0) {
        return prev.map((it, i) =>
          i === idx ? { ...it, cantidad: it.cantidad + 1 } : it,
        );
      }
      return [
        ...prev,
        {
          tipo: "producto",
          servicio_id: null,
          producto_id: p.id,
          descripcion: p.nombre,
          cantidad: 1,
          precio_unit: Number(p.precio),
        },
      ];
    });
    setAviso(`Agregado: ${p.nombre}`);
    setTimeout(() => setAviso(""), 1200);
  }

  function onScan(code: string) {
    const p = productos.find((x) => x.codigo_barras === code);
    if (!p) {
      setError(`Código ${code} no está ligado a ningún producto.`);
      return;
    }
    agregarProducto(p);
  }

  function agregarServicio() {
    setItems((prev) => [
      ...prev,
      { tipo: "servicio", servicio_id: null, producto_id: null, descripcion: "", cantidad: 1, precio_unit: 0 },
    ]);
  }

  function elegirServicio(i: number, sid: string) {
    const s = servicios.find((x) => x.id === sid);
    setItem(i, {
      servicio_id: sid || null,
      descripcion: s?.nombre ?? "",
      precio_unit: s ? Number(s.precio) : items[i].precio_unit,
    });
  }

  const sugerencias = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return [];
    return productos
      .filter((p) => p.nombre.toLowerCase().includes(q))
      .slice(0, 6);
  }, [busca, productos]);

  async function guardar() {
    setError("");
    if (items.length === 0) {
      setError("Agrega al menos un concepto.");
      return;
    }
    setGuardando(true);
    const r = await crearCobro({ paciente_id: pacienteId, items, metodo, nota });
    setGuardando(false);
    if (!r.ok) {
      setError(r.error ?? "Error al guardar.");
      return;
    }
    router.push("/cobros");
    router.refresh();
  }

  const fmt = (n: number) =>
    n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

  return (
    <div className="space-y-5 rounded-xl bg-white p-5 ring-1 ring-zinc-200">
      <div>
        <label className="block text-xs text-zinc-500">Paciente</label>
        <select
          value={pacienteId}
          onChange={(e) => setPacienteId(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        >
          <option value="">— Selecciona —</option>
          {pacientes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      </div>

      {/* BIP — escanear producto del inventario */}
      <div>
        <label className="block text-xs text-zinc-500">
          Escanear producto (BIP) o buscar
        </label>
        <div className="mt-1">
          <BarcodeInput onScan={onScan} autoFocus={false} />
        </div>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="…o busca un producto por nombre"
          className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
        />
        {sugerencias.length > 0 && (
          <div className="mt-1 space-y-0.5 rounded-lg border border-zinc-200 p-1">
            {sugerencias.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  agregarProducto(p);
                  setBusca("");
                }}
                disabled={p.stock <= 0}
                className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-sm hover:bg-zinc-100 disabled:opacity-40"
              >
                <span>{p.nombre}</span>
                <span className="text-xs text-zinc-400">
                  stock {p.stock} · {fmt(Number(p.precio))}
                </span>
              </button>
            ))}
          </div>
        )}
        {aviso && <p className="mt-1 text-xs text-green-700">{aviso}</p>}
      </div>

      {/* Conceptos (servicios + productos) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs text-zinc-500">Conceptos</label>
          <button
            onClick={agregarServicio}
            className="text-sm text-zinc-600 hover:text-zinc-900"
          >
            + Agregar servicio
          </button>
        </div>

        {items.length === 0 && (
          <p className="rounded-lg bg-zinc-50 px-3 py-3 text-center text-xs text-zinc-400">
            Escanea un producto o agrega un servicio.
          </p>
        )}

        {items.map((it, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            {it.tipo === "producto" ? (
              <span className="flex-1 truncate rounded-lg bg-[#f1ebe1] px-2 py-1.5 text-sm text-zinc-800">
                📦 {it.descripcion}
              </span>
            ) : (
              <>
                <select
                  value={it.servicio_id ?? ""}
                  onChange={(e) => elegirServicio(i, e.target.value)}
                  className="min-w-[9rem] flex-1 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
                >
                  <option value="">— Servicio / libre —</option>
                  {servicios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
                {!it.servicio_id && (
                  <input
                    placeholder="Concepto"
                    value={it.descripcion}
                    onChange={(e) => setItem(i, { descripcion: e.target.value })}
                    className="flex-1 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
                  />
                )}
              </>
            )}
            <input
              type="number"
              min={1}
              value={it.cantidad}
              onChange={(e) => setItem(i, { cantidad: Number(e.target.value) || 1 })}
              className="w-14 rounded-lg border border-zinc-300 px-2 py-1.5 text-center text-sm"
            />
            <div className="flex items-center gap-1">
              <span className="text-zinc-400">$</span>
              <input
                type="number"
                value={it.precio_unit}
                onChange={(e) => setItem(i, { precio_unit: Number(e.target.value) || 0 })}
                className="w-24 rounded-lg border border-zinc-300 px-2 py-1.5 text-right text-sm"
              />
            </div>
            <button
              onClick={() => quitar(i)}
              className="text-zinc-400 hover:text-red-600"
              title="Quitar"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 border-t border-zinc-100 pt-4">
        <div>
          <label className="block text-xs text-zinc-500">Método de pago</label>
          <select
            value={metodo}
            onChange={(e) => setMetodo(e.target.value as Metodo)}
            className="mt-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="transferencia">Transferencia</option>
            <option value="efectivo">Efectivo</option>
            <option value="tarjeta">Tarjeta</option>
            <option value="otro">Otro</option>
          </select>
        </div>
        <div className="text-right">
          <p className="text-xs text-zinc-500">Total</p>
          <p className="text-2xl font-semibold text-zinc-900">{fmt(total)}</p>
        </div>
      </div>

      <input
        placeholder="Nota (opcional)"
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        onClick={guardar}
        disabled={guardando}
        className="w-full rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
      >
        {guardando ? "Guardando…" : "Registrar cobro"}
      </button>
    </div>
  );
}
