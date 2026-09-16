"use client";

import { useMemo, useState, useTransition } from "react";
import { crearHistoria } from "../actions";
import {
  aplicaPorSexo,
  calcularImcHistoria,
  campoVisible,
  sexoNormalizado,
  valoresParaGuardar,
  NO_APLICA,
  type CampoHistoria,
} from "@/lib/historia-campos";

export type Campo = CampoHistoria;
export type Tipo = {
  id: string;
  nombre: string;
  campos_historia: Campo[];
};

const input =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900";

// Los campos precargados arrancan con su valor por omisión para que Fernanda
// solo corrija lo que cambia.
function valoresIniciales(campos: Campo[]): Record<string, unknown> {
  const valores: Record<string, unknown> = {};
  for (const campo of campos) {
    if (campo.valor_default != null && campo.valor_default !== "") {
      valores[campo.id] = campo.valor_default;
    }
  }
  return valores;
}

export default function NuevaHistoria({
  pacienteId,
  sexo,
  tipos,
}: {
  pacienteId: string;
  sexo: string | null;
  tipos: Tipo[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [tipoId, setTipoId] = useState("");
  const [valores, setValores] = useState<Record<string, unknown>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const sexoPaciente = useMemo(() => sexoNormalizado(sexo), [sexo]);
  const tipo = tipos.find((t) => t.id === tipoId);

  // Campos capturables, ya sin los retirados, agrupados como se imprimen.
  const secciones = useMemo(() => {
    const vivos = (tipo?.campos_historia ?? []).filter((campo) => !campo.oculto);
    const grupos: { nombre: string; campos: Campo[] }[] = [];
    for (const campo of vivos) {
      const nombre = campo.seccion ?? "Datos";
      const grupo = grupos.find((g) => g.nombre === nombre);
      if (grupo) grupo.campos.push(campo);
      else grupos.push({ nombre, campos: [campo] });
    }
    return grupos;
  }, [tipo]);

  const roles = useMemo(() => {
    const vivos = tipo?.campos_historia ?? [];
    return {
      peso: vivos.find((campo) => campo.rol === "peso"),
      talla: vivos.find((campo) => campo.rol === "talla"),
      imc: vivos.find((campo) => campo.rol === "imc"),
    };
  }, [tipo]);

  function setCampo(id: string, v: unknown) {
    setValores((prev) => {
      const siguientes = { ...prev, [id]: v };
      // El IMC se recalcula al capturar peso o talla, como lo pidió la doctora.
      const { peso, talla, imc } = roles;
      if (imc && ((peso && id === peso.id) || (talla && id === talla.id))) {
        const calculado = calcularImcHistoria(
          peso ? siguientes[peso.id] : null,
          talla ? siguientes[talla.id] : null,
        );
        if (calculado !== "") siguientes[imc.id] = Number(calculado);
      }
      return siguientes;
    });
  }

  function guardar() {
    setMsg(null);
    if (!tipoId || !tipo) {
      setMsg("Selecciona un tipo de historia.");
      return;
    }
    // Solo se exige lo que de verdad se está preguntando.
    const faltantes = tipo.campos_historia.filter(
      (campo) =>
        campo.requerido &&
        campoVisible(campo, valores, sexoPaciente) &&
        (valores[campo.id] === undefined ||
          valores[campo.id] === null ||
          String(valores[campo.id]).trim() === ""),
    );
    if (faltantes.length) {
      setMsg(`Falta completar: ${faltantes.map((campo) => campo.etiqueta).join(", ")}.`);
      return;
    }
    const paquete = valoresParaGuardar(tipo.campos_historia, valores, sexoPaciente);
    startTransition(async () => {
      const res = await crearHistoria(pacienteId, tipoId, paquete);
      if (!res.ok) {
        setMsg(res.error ?? "Error al guardar.");
        return;
      }
      setValores({});
      setTipoId("");
      setAbierto(false);
    });
  }

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="mb-6 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
      >
        + Nueva historia clínica
      </button>
    );
  }

  return (
    <div className="mb-6 rounded-xl bg-white p-5 ring-1 ring-zinc-200">
      <label className="mb-1 block text-xs font-medium text-zinc-600">
        Tipo de historia
      </label>
      <select
        value={tipoId}
        onChange={(e) => {
          const id = e.target.value;
          setTipoId(id);
          setValores(valoresIniciales(tipos.find((t) => t.id === id)?.campos_historia ?? []));
        }}
        className={`${input} mb-4`}
      >
        <option value="">Selecciona…</option>
        {tipos.map((t) => (
          <option key={t.id} value={t.id}>
            {t.nombre}
          </option>
        ))}
      </select>

      {tipo && (
        <div className="space-y-3">
          {secciones.map((seccion) => {
            const visibles = seccion.campos.filter((campo) =>
              campoVisible(campo, valores, sexoPaciente),
            );
            // Una sección entera que no corresponde al sexo del paciente se
            // anuncia como no aplicable en vez de desaparecer sin más.
            const noAplica =
              visibles.length === 0 &&
              seccion.campos.every((campo) => !aplicaPorSexo(campo, sexoPaciente));
            if (visibles.length === 0 && !noAplica) return null;
            return (
              <div key={seccion.nombre}>
                <h4 className="mb-2 mt-5 border-b border-zinc-200 pb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {seccion.nombre}
                </h4>
                {noAplica ? (
                  <p className="rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-500">
                    {NO_APLICA}. Se guarda así en la historia.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {visibles.map((c) => (
                      <div key={c.id}>
                        <label className="mb-1 block text-xs font-medium text-zinc-600">
                          {c.etiqueta}{" "}
                          {c.requerido && <span className="text-red-500">*</span>}
                          {c.rol === "imc" && (
                            <span className="font-normal text-zinc-400">(automático)</span>
                          )}
                        </label>
                        {c.tipo_dato === "booleano" ? (
                          <div className="grid grid-cols-3 gap-2" role="group" aria-label={c.etiqueta}>
                            {[
                              [true, "Sí"],
                              [false, "No"],
                              [null, "Sin responder"],
                            ].map(([opcion, etiqueta]) => {
                              const activo =
                                opcion === null
                                  ? valores[c.id] === undefined || valores[c.id] === null
                                  : valores[c.id] === opcion;
                              return (
                                <button
                                  key={etiqueta as string}
                                  type="button"
                                  aria-pressed={activo}
                                  onClick={() => setCampo(c.id, opcion)}
                                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                                    activo
                                      ? "border-[#8c7a63] bg-[#f1ebe1] text-[#6f604e]"
                                      : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                                  }`}
                                >
                                  {etiqueta as string}
                                </button>
                              );
                            })}
                          </div>
                        ) : c.tipo_dato === "textarea" ? (
                          <textarea
                            className={`${input} min-h-20`}
                            rows={3}
                            value={String(valores[c.id] ?? "")}
                            onChange={(e) => setCampo(c.id, e.target.value)}
                          />
                        ) : c.tipo_dato === "opciones" ? (
                          <select
                            className={input}
                            value={String(valores[c.id] ?? "")}
                            onChange={(e) => setCampo(c.id, e.target.value)}
                          >
                            <option value="">—</option>
                            {(c.opciones ?? []).map((o) => (
                              <option key={o} value={o}>
                                {o}
                              </option>
                            ))}
                          </select>
                        ) : c.tipo_dato === "multi" ? (
                          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                            {(c.opciones ?? []).map((o) => {
                              const arr = Array.isArray(valores[c.id])
                                ? (valores[c.id] as string[])
                                : [];
                              return (
                                <label
                                  key={o}
                                  className="flex items-center gap-1.5 text-sm text-zinc-700"
                                >
                                  <input
                                    type="checkbox"
                                    checked={arr.includes(o)}
                                    onChange={(e) =>
                                      setCampo(
                                        c.id,
                                        e.target.checked
                                          ? [...arr, o]
                                          : arr.filter((x) => x !== o),
                                      )
                                    }
                                  />
                                  {o}
                                </label>
                              );
                            })}
                          </div>
                        ) : (
                          <input
                            className={input}
                            type={
                              c.tipo_dato === "numero"
                                ? "number"
                                : c.tipo_dato === "fecha"
                                  ? "date"
                                  : "text"
                            }
                            value={String(valores[c.id] ?? "")}
                            onChange={(e) =>
                              setCampo(
                                c.id,
                                c.tipo_dato === "numero"
                                  ? e.target.value === ""
                                    ? ""
                                    : Number(e.target.value)
                                  : e.target.value,
                              )
                            }
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {msg && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {msg}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <button
          onClick={guardar}
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Guardar historia"}
        </button>
        <button
          onClick={() => setAbierto(false)}
          className="rounded-lg px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
