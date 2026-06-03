"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type PuntoProgreso = {
  fecha: string; // etiqueta corta DD/MM
  peso: number | null;
  imc: number | null;
  grasa: number | null;
  cintura: number | null;
};

export default function ProgresoPeso({ puntos }: { puntos: PuntoProgreso[] }) {
  const conPeso = puntos.filter((p) => p.peso != null);
  if (conPeso.length === 0) return null;

  const inicial = conPeso[0].peso!;
  const actual = conPeso[conPeso.length - 1].peso!;
  const delta = actual - inicial;
  const ultimo = puntos[puntos.length - 1];

  const fmt = (n: number | null, u = "") =>
    n == null ? "—" : `${n.toLocaleString("es-MX")}${u}`;

  return (
    <div className="mb-6 rounded-xl bg-white p-5 ring-1 ring-zinc-200">
      <h2 className="mb-4 font-medium text-zinc-900">Progreso de peso</h2>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Mini label="Peso inicial" value={fmt(inicial, " kg")} />
        <Mini label="Peso actual" value={fmt(actual, " kg")} />
        <Mini
          label={delta <= 0 ? "Peso perdido" : "Peso ganado"}
          value={`${delta > 0 ? "+" : "−"}${Math.abs(delta).toLocaleString("es-MX", { maximumFractionDigits: 1 })} kg`}
          tono={delta < 0 ? "bueno" : delta > 0 ? "malo" : "neutro"}
        />
        <Mini label="IMC actual" value={fmt(ultimo?.imc ?? null)} />
      </div>

      {conPeso.length >= 2 ? (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart
            data={conPeso}
            margin={{ top: 8, right: 12, left: -10, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
            <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: "#71717a" }} />
            <YAxis
              tick={{ fontSize: 11, fill: "#71717a" }}
              width={40}
              domain={["dataMin - 2", "dataMax + 2"]}
            />
            <Tooltip
              formatter={(v) => [`${v} kg`, "Peso"]}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Line
              type="monotone"
              dataKey="peso"
              stroke="#18181b"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-sm text-zinc-400">
          Con una sola medición aún no hay curva. Registra otro InBody para ver
          la evolución.
        </p>
      )}

      {(ultimo?.grasa != null || ultimo?.cintura != null) && (
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-500">
          {ultimo?.grasa != null && <span>% Grasa: {fmt(ultimo.grasa, "%")}</span>}
          {ultimo?.cintura != null && (
            <span>Cintura: {fmt(ultimo.cintura, " cm")}</span>
          )}
        </div>
      )}
    </div>
  );
}

function Mini({
  label,
  value,
  tono = "neutro",
}: {
  label: string;
  value: string;
  tono?: "bueno" | "malo" | "neutro";
}) {
  const color =
    tono === "bueno"
      ? "text-green-600"
      : tono === "malo"
        ? "text-red-600"
        : "text-zinc-900";
  return (
    <div className="rounded-lg bg-zinc-50 px-3 py-2">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`mt-0.5 text-base font-semibold tabular-nums ${color}`}>
        {value}
      </p>
    </div>
  );
}
