"use client";

import { useActionState, useState } from "react";
import { actualizarProducto, type ActionResult } from "../actions";

export type ProductoEdit = {
  id: string;
  nombre: string;
  precio_venta: number;
  stock_minimo: number;
  es_controlado: boolean;
  requiere_receta: boolean;
  fraccion_cofepris: string;
  codigo_barras: string | null;
};

const inicial: ActionResult = { ok: false };
const input =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900";
const label = "mb-1 block text-xs font-medium text-zinc-600";

export default function EditarProducto({ producto }: { producto: ProductoEdit }) {
  const [abierto, setAbierto] = useState(false);
  const action = actualizarProducto.bind(null, producto.id);
  const [state, formAction, pending] = useActionState(action, inicial);

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
      >
        Editar producto
      </button>
    );
  }

  return (
    <div className="mb-6 rounded-xl bg-white p-5 ring-1 ring-zinc-200">
      <form action={formAction} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={label}>Nombre *</label>
            <input name="nombre" required defaultValue={producto.nombre} className={input} />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Código de barras / SKU</label>
            <input
              name="codigo_barras"
              defaultValue={producto.codigo_barras ?? ""}
              className={input}
            />
          </div>
          <div>
            <label className={label}>Precio de venta</label>
            <input
              name="precio_venta"
              type="number"
              step="0.01"
              defaultValue={producto.precio_venta}
              className={input}
            />
          </div>
          <div>
            <label className={label}>Stock mínimo</label>
            <input
              name="stock_minimo"
              type="number"
              step="1"
              defaultValue={producto.stock_minimo}
              className={input}
            />
          </div>
          <div>
            <label className={label}>Fracción COFEPRIS</label>
            <select
              name="fraccion_cofepris"
              defaultValue={producto.fraccion_cofepris}
              className={input}
            >
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
              <input
                type="checkbox"
                name="es_controlado"
                defaultChecked={producto.es_controlado}
              />{" "}
              Controlado
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                name="requiere_receta"
                defaultChecked={producto.requiere_receta}
              />{" "}
              Requiere receta
            </label>
          </div>
        </div>

        {state.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        )}
        {state.ok && (
          <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
            Producto actualizado.
          </p>
        )}

        <div className="flex gap-2">
          <button
            disabled={pending}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {pending ? "Guardando…" : "Guardar cambios"}
          </button>
          <button
            type="button"
            onClick={() => setAbierto(false)}
            className="rounded-lg px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100"
          >
            Cerrar
          </button>
        </div>
      </form>
    </div>
  );
}
