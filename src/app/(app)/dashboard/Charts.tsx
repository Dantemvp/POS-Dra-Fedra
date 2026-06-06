"use client";

import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const money = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

// Paleta de marca Dra. Fedra: taupe, rosé nude, cocoa, arena, gris cálido.
const COLORS = ["#b19b7d", "#c8a4a0", "#8c7a63", "#cbb89c", "#9a8c7a"];
const TAUPE = "#b19b7d";

// Ejes/cursor: colores fijos legibles en claro y oscuro (Recharts aplica fill
// como atributo SVG, donde var(--...) no resuelve). El tooltip sí usa estilo
// de div, así que ahí sí adaptamos al tema con variables.
const AXIS = "#928a80";
const CURSOR = "rgba(177,155,125,0.14)";
const tooltipStyle = {
  fontSize: 12,
  borderRadius: 8,
  background: "var(--color-white)",
  border: "1px solid var(--color-zinc-200)",
  color: "var(--color-zinc-900)",
};

export function VentasDiaChart({
  data,
}: {
  data: { dia: string; total: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
        <XAxis dataKey="dia" tick={{ fontSize: 11, fill: AXIS }} />
        <YAxis tick={{ fontSize: 11, fill: AXIS }} width={48} />
        <Tooltip
          formatter={(v) => money(Number(v))}
          contentStyle={tooltipStyle}
          cursor={{ fill: CURSOR }}
        />
        <Bar dataKey="total" fill={TAUPE} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MetodoChart({
  data,
}: {
  data: { name: string; value: number }[];
}) {
  if (data.length === 0)
    return <p className="py-12 text-center text-sm text-zinc-400">Sin datos.</p>;
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex items-center gap-4">
      <div className="h-[180px] w-[180px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={45}
              outerRadius={75}
              paddingAngle={2}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => money(Number(v))} contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex-1 space-y-2 text-sm">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-zinc-700">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              {d.name}
            </span>
            <span className="text-right tabular-nums">
              <span className="font-medium text-zinc-900">{money(d.value)}</span>
              <span className="ml-2 text-xs text-zinc-400">
                {total ? Math.round((d.value / total) * 100) : 0}%
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TopProductosChart({
  data,
}: {
  data: { nombre: string; cantidad: number }[];
}) {
  if (data.length === 0)
    return (
      <p className="py-12 text-center text-sm text-zinc-400">
        Aún no hay ventas.
      </p>
    );
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
      >
        <XAxis type="number" tick={{ fontSize: 11, fill: AXIS }} />
        <YAxis
          type="category"
          dataKey="nombre"
          width={120}
          tick={{ fontSize: 11, fill: AXIS }}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: CURSOR }}
        />
        <Bar dataKey="cantidad" fill={TAUPE} radius={[0, 4, 4, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// Distribución de pacientes por fase de tratamiento.
export function PacientesFaseChart({
  data,
}: {
  data: { fase: string; pacientes: number }[];
}) {
  if (data.length === 0)
    return (
      <p className="py-12 text-center text-sm text-zinc-400">
        Aún no hay pacientes con fase asignada.
      </p>
    );
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
        <XAxis dataKey="fase" tick={{ fontSize: 11, fill: AXIS }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: AXIS }} width={32} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: CURSOR }} />
        <Bar dataKey="pacientes" fill={TAUPE} radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// Recetas y citas por mes (últimos 12 meses).
export function PorMesChart({
  data,
}: {
  data: { mes: string; recetas: number; citas: number }[];
}) {
  if (data.length === 0)
    return <p className="py-12 text-center text-sm text-zinc-400">Sin datos.</p>;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
        <XAxis dataKey="mes" tick={{ fontSize: 10, fill: AXIS }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: AXIS }} width={32} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: AXIS, strokeWidth: 1 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="recetas" name="Recetas" stroke="#b19b7d" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="citas" name="Citas" stroke="#c8a4a0" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// Ingresos del consultorio por mes (cobros).
export function IngresosMesChart({
  data,
}: {
  data: { mes: string; total: number }[];
}) {
  if (data.length === 0)
    return (
      <p className="py-12 text-center text-sm text-zinc-400">
        Aún no hay cobros registrados.
      </p>
    );
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
        <XAxis dataKey="mes" tick={{ fontSize: 10, fill: AXIS }} />
        <YAxis tick={{ fontSize: 11, fill: AXIS }} width={64} tickFormatter={(v) => money(Number(v))} />
        <Tooltip formatter={(v) => money(Number(v))} contentStyle={tooltipStyle} cursor={{ fill: CURSOR }} />
        <Bar dataKey="total" fill={TAUPE} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
