"use client";

import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const money = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

const COLORS = ["#18181b", "#52525b", "#a1a1aa", "#d4d4d8", "#71717a"];

export function VentasDiaChart({
  data,
}: {
  data: { dia: string; total: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
        <XAxis dataKey="dia" tick={{ fontSize: 11, fill: "#71717a" }} />
        <YAxis tick={{ fontSize: 11, fill: "#71717a" }} width={48} />
        <Tooltip
          formatter={(v) => money(Number(v))}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <Bar dataKey="total" fill="#18181b" radius={[4, 4, 0, 0]} />
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
            <Tooltip
              formatter={(v) => money(Number(v))}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
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
        <XAxis type="number" tick={{ fontSize: 11, fill: "#71717a" }} />
        <YAxis
          type="category"
          dataKey="nombre"
          width={120}
          tick={{ fontSize: 11, fill: "#3f3f46" }}
        />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Bar dataKey="cantidad" fill="#18181b" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
