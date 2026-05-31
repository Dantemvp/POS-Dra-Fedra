"use client";

import { useActionState, useState } from "react";
import { crearProducto, registrarEntrada, type ActionResult } from "./actions";

const inicial: ActionResult = { ok: false };

export default function FormsInventario({
  productos,
}: {
  productos: { id: string; nombre: string }[];
}) {
  const [tab, setTab] = useState<"producto" | "entrada">("producto");

  return (
    <div className="mb-6 rounded-xl bg-white p-4 ring-1 ring-zinc-200">
      <div className="mb-4 flex gap-2">
        <TabBtn active={tab === "producto"} onClick={() => setTab("producto")}>
          Nuevo producto
        </TabBtn>
        <TabBtn active={tab === "entrada"} onClick={() => setTab("entrada")}>
          Registrar entrada
        </TabBtn>
      </div>
      {tab === "producto" ? (
        <NuevoProducto />
      ) : (
        <Entrada productos={productos} />
      )}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
        active ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"
      }`}
    >
      {children}
    </button>
  );
}

function Aviso({ state }: { state: ActionResult }) {
  if (state.ok)
    return (
      <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
        Guardado correctamente.
      </p>
    );
  if (state.error)
    return (
      <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
        {state.error}
      </p>
    );
  return null;
}

const input =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900";
const label = "mb-1 block text-xs font-medium text-zinc-600";

function NuevoProducto() {
  const [state, action, pending] = useActionState(crearProducto, inicial);
  return (
    <form action={action} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={label}>Nombre del producto *</label>
          <input name="nombre" required className={input} placeholder="Ej. Victoza 6 mg/mL" />
        </div>
        <div className="sm:col-span-2">
          <label className={label}>Código de barras / SKU</label>
          <input name="codigo_barras" className={input} placeholder="Escanea o escribe el código" />
        </div>
        <div>
          <label className={label}>Precio de venta</label>
          <input name="precio_venta" type="number" step="0.01" min="0" className={input} placeholder="0.00" />
        </div>
        <div>
          <label className={label}>Stock mínimo (alerta)</label>
          <input name="stock_minimo" type="number" step="1" min="0" className={input} placeholder="0" />
        </div>
        <div>
          <label className={label}>Fracción COFEPRIS</label>
          <select name="fraccion_cofepris" className={input} defaultValue="na">
            <option value="na">No aplica</option>
            <option value="I">Fracción I</option>
            <option value="II">Fracción II</option>
            <option value="III">Fracción III</option>
            <option value="IV">Fracción IV</option>
            <option value="V">Fracción V</option>
            <option value="VI">Fracción VI</option>
          </select>
        </div>
        <div className="flex items-end gap-4">
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input type="checkbox" name="es_controlado" /> Controlado
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input type="checkbox" name="requiere_receta" /> Requiere receta
          </label>
        </div>
      </div>
      <Aviso state={state} />
      <button
        disabled={pending}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50"
      >
        {pending ? "Guardando…" : "Agregar producto"}
      </button>
    </form>
  );
}

function Entrada({ productos }: { productos: { id: string; nombre: string }[] }) {
  const [state, action, pending] = useActionState(registrarEntrada, inicial);
  return (
    <form action={action} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={label}>Producto *</label>
          <select name="producto_id" required className={input} defaultValue="">
            <option value="" disabled>
              Selecciona un producto…
            </option>
            {productos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Cantidad *</label>
          <input name="cantidad" type="number" step="1" min="1" required className={input} placeholder="0" />
        </div>
        <div>
          <label className={label}>Lote</label>
          <input name="lote" className={input} placeholder="Ej. L2026-04" />
        </div>
        <div>
          <label className={label}>Caducidad</label>
          <input name="caducidad" type="date" className={input} />
        </div>
        <div>
          <label className={label}>Costo unitario</label>
          <input name="costo" type="number" step="0.01" min="0" className={input} placeholder="0.00" />
        </div>
      </div>
      <Aviso state={state} />
      <button
        disabled={pending || productos.length === 0}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50"
      >
        {pending ? "Registrando…" : "Registrar entrada"}
      </button>
      {productos.length === 0 && (
        <p className="text-xs text-zinc-400">Primero agrega un producto.</p>
      )}
    </form>
  );
}
