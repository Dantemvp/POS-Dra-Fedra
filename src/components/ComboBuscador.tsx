"use client";

import { useMemo, useRef, useState } from "react";

// Selector con búsqueda por texto. Reemplaza a los <select> largos (pacientes,
// servicios, productos) donde desplazar la lista es tedioso. Funciona en dos
// modos, según el formulario que lo use:
//   - Controlado: pásale `value` + `onChange(value)`.
//   - Form server-action: pásale además `name` y emite un <input hidden> con
//     ese name, para que formData.get(name) lo lea igual que un <select>.
export type OpcionCombo = { value: string; label: string; hint?: string };

const baseInput =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900";

export default function ComboBuscador({
  opciones,
  value,
  onChange,
  name,
  placeholder = "Escribe para buscar…",
  requerido = false,
  disabled = false,
}: {
  opciones: OpcionCombo[];
  value: string;
  onChange?: (value: string) => void;
  name?: string;
  placeholder?: string;
  requerido?: boolean;
  disabled?: boolean;
}) {
  const [q, setQ] = useState("");
  const [abierto, setAbierto] = useState(false);
  const cerrarRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const elegido = opciones.find((o) => o.value === value) ?? null;

  const filtradas = useMemo(() => {
    const s = q.trim().toLowerCase();
    const base = s
      ? opciones.filter((o) => o.label.toLowerCase().includes(s))
      : opciones;
    return base.slice(0, 8);
  }, [q, opciones]);

  function elegir(o: OpcionCombo) {
    onChange?.(o.value);
    setQ("");
    setAbierto(false);
  }

  function limpiar() {
    onChange?.("");
    setQ("");
  }

  return (
    <div className="relative">
      {name && <input type="hidden" name={name} value={value} />}

      <div className="flex items-center gap-1">
        <input
          // Cuando hay algo elegido y el campo no está activo, mostramos su
          // etiqueta; al enfocar se limpia para poder escribir y buscar.
          value={abierto ? q : (elegido?.label ?? "")}
          onChange={(e) => {
            setQ(e.target.value);
            setAbierto(true);
          }}
          onFocus={() => {
            if (cerrarRef.current) clearTimeout(cerrarRef.current);
            setAbierto(true);
            setQ("");
          }}
          onBlur={() => {
            // Pequeño retraso para que el click en una opción alcance a registrarse.
            cerrarRef.current = setTimeout(() => setAbierto(false), 150);
          }}
          placeholder={elegido ? elegido.label : placeholder}
          disabled={disabled}
          className={baseInput}
          autoComplete="off"
        />
        {elegido && !disabled && (
          <button
            type="button"
            onClick={limpiar}
            className="shrink-0 rounded-lg px-2 py-2 text-zinc-400 hover:text-red-600"
            title="Quitar selección"
            tabIndex={-1}
          >
            ✕
          </button>
        )}
      </div>

      {/* Marca de requerido para validación nativa de forms (sin romper el layout). */}
      {requerido && name && (
        <input
          tabIndex={-1}
          aria-hidden
          required
          value={value}
          onChange={() => {}}
          className="sr-only h-0 w-0"
        />
      )}

      {abierto && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-zinc-200 bg-white p-1 shadow-lg">
          {filtradas.length === 0 ? (
            <p className="px-3 py-2 text-sm text-zinc-400">Sin resultados.</p>
          ) : (
            filtradas.map((o) => (
              <button
                key={o.value}
                type="button"
                onMouseDown={(e) => e.preventDefault()} // evita el blur antes del click
                onClick={() => elegir(o)}
                className="flex w-full items-center justify-between gap-2 rounded px-3 py-2 text-left text-sm hover:bg-zinc-100"
              >
                <span className="truncate text-zinc-800">{o.label}</span>
                {o.hint && (
                  <span className="shrink-0 text-xs text-zinc-400">{o.hint}</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
