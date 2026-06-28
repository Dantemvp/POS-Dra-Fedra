"use client";

import { useState, useTransition } from "react";
import { registrarCorte } from "./actions";

const money = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

const ETIQUETA_METODO: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  otro: "Otro",
};

export default function CorteDelDia({
  numVentas,
  totalVentas,
  totalCobros,
  productosSalidos,
  pacientesAtendidos,
  efectivoEsperado,
  desglose,
  fecha,
}: {
  numVentas: number;
  totalVentas: number;
  totalCobros: number;
  productosSalidos: number;
  pacientesAtendidos: number;
  efectivoEsperado: number;
  desglose: Record<string, number>;
  fecha: string;
}) {
  const [contado, setContado] = useState("");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const contadoNum = contado === "" ? null : Number(contado) || 0;
  const diferencia = contadoNum === null ? null : contadoNum - efectivoEsperado;
  const metodos = Object.entries(desglose).filter(([, v]) => v > 0);

  function cerrarCorte() {
    setMsg(null);
    startTransition(async () => {
      const res = await registrarCorte({
        totalVentas,
        totalCobros,
        efectivoEsperado,
        efectivoContado: contadoNum,
        diferencia,
        totalProductos: productosSalidos,
        pacientesAtendidos,
        desglose,
      });
      setMsg(res.ok ? "Corte guardado." : (res.error ?? "Error al guardar."));
    });
  }

  return (
    <div className="doc-imprimible rounded-xl bg-white p-5 ring-1 ring-zinc-200">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">
            Corte del día
          </h2>
          <p className="text-xs text-zinc-500">{fecha}</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <button
            onClick={() => window.print()}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Imprimir
          </button>
          <button
            onClick={cerrarCorte}
            disabled={pending}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {pending ? "Guardando…" : "Cerrar corte"}
          </button>
        </div>
      </div>

      {/* Resumen de actividad */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Dato label="Ventas (farmacia)" valor={money(totalVentas)} />
        <Dato label="Cobros (consultorio)" valor={money(totalCobros)} />
        <Dato label="Total del día" valor={money(totalVentas + totalCobros)} />
        <Dato label="N.º de ventas" valor={String(numVentas)} />
        <Dato label="Productos salidos" valor={String(productosSalidos)} />
        <Dato label="Pacientes atendidos" valor={String(pacientesAtendidos)} />
      </div>

      {/* Desglose por método */}
      <div className="mt-4 border-t border-zinc-100 pt-3">
        <p className="mb-2 text-xs font-medium uppercase text-zinc-500">
          Por método de pago
        </p>
        <ul className="space-y-1">
          {metodos.length === 0 ? (
            <li className="text-sm text-zinc-400">Sin movimientos hoy.</li>
          ) : (
            metodos.map(([m, v]) => (
              <li
                key={m}
                className="flex justify-between text-sm text-zinc-700"
              >
                <span>{ETIQUETA_METODO[m] ?? m}</span>
                <span className="tabular-nums">{money(v)}</span>
              </li>
            ))
          )}
        </ul>
      </div>

      {/* Cuadre de efectivo */}
      <div className="mt-4 border-t border-zinc-100 pt-3">
        <p className="mb-2 text-xs font-medium uppercase text-zinc-500">
          Cuadre de efectivo
        </p>
        <div className="flex justify-between text-sm text-zinc-700">
          <span>Efectivo esperado</span>
          <span className="tabular-nums">{money(efectivoEsperado)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <label className="text-sm text-zinc-700">Efectivo contado</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={contado}
            onChange={(e) => setContado(e.target.value)}
            placeholder="0.00"
            className="w-32 rounded-lg border border-zinc-300 px-3 py-1.5 text-right text-sm tabular-nums outline-none focus:border-zinc-900 print:border-none"
          />
        </div>
        {diferencia !== null && (
          <div className="mt-2 flex justify-between border-t border-zinc-100 pt-2 text-sm font-medium">
            <span className="text-zinc-700">
              {diferencia === 0
                ? "Caja cuadrada"
                : diferencia > 0
                  ? "Sobrante"
                  : "Faltante"}
            </span>
            <span
              className={`tabular-nums ${
                diferencia === 0
                  ? "text-green-700"
                  : diferencia > 0
                    ? "text-amber-700"
                    : "text-red-600"
              }`}
            >
              {money(Math.abs(diferencia))}
            </span>
          </div>
        )}
      </div>

      {msg && (
        <p className="mt-3 text-sm text-zinc-500 print:hidden">{msg}</p>
      )}
    </div>
  );
}

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-0.5 text-base font-semibold tabular-nums text-zinc-900">
        {valor}
      </p>
    </div>
  );
}
