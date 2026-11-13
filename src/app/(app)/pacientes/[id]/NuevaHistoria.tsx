"use client";

import { useMemo, useState, useTransition } from "react";
import { crearHistoria } from "../actions";
import CamposHistoria from "@/components/CamposHistoria";
import RespuestasPaciente from "./RespuestasPaciente";
import {
  calcularImcHistoria,
  campoVisible,
  sexoNormalizado,
  valoresParaGuardar,
  prepararCamposHistoria,
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
  nombrePaciente = "Paciente actual",
}: {
  pacienteId: string;
  sexo: string | null;
  tipos: Tipo[];
  nombrePaciente?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [tipoId, setTipoId] = useState("");
  const [valores, setValores] = useState<Record<string, unknown>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const sexoPaciente = useMemo(() => sexoNormalizado(sexo), [sexo]);
  const tipo = useMemo(() => {
    const elegido = tipos.find((t) => t.id === tipoId);
    return elegido ? { ...elegido, campos_historia: prepararCamposHistoria(elegido.campos_historia) } : undefined;
  }, [tipos, tipoId]);

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
      <>
      <RespuestasPaciente nombrePaciente={nombrePaciente} sexoPaciente={sexo} tipos={tipos} onImportar={(id, respuestas, nombre) => {
        if (Object.keys(valores).length && !window.confirm("¿Reemplazar el borrador actual por las respuestas del archivo?")) return;
        setTipoId(id); setValores(respuestas); setAbierto(true); setMsg(`Respuestas de ${nombre} cargadas como borrador. Revisa con el paciente antes de guardar.`);
      }} />
      <button
        onClick={() => setAbierto(true)}
        className="mb-6 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
      >
        + Nueva historia clínica
      </button>
      </>
    );
  }

  return (
    <div className="mb-6 rounded-xl bg-white p-5 ring-1 ring-zinc-200">
      <RespuestasPaciente nombrePaciente={nombrePaciente} sexoPaciente={sexo} tipos={tipos} disabled={pending} onImportar={(id, respuestas, nombre) => {
        if (Object.keys(valores).length && !window.confirm("¿Reemplazar el borrador actual por las respuestas del archivo?")) return;
        setTipoId(id); setValores(respuestas); setMsg(`Respuestas de ${nombre} cargadas como borrador. Revisa antes de guardar.`);
      }} />
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

      {tipo && <CamposHistoria campos={tipo.campos_historia} valores={valores} sexo={sexoPaciente} onChange={setCampo} disabled={pending} />}

      {msg && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
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
