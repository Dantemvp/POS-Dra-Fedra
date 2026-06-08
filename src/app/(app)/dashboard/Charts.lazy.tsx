"use client";

import dynamic from "next/dynamic";

// Versiones diferidas de las gráficas: recharts es pesado y no debe ir en el
// bundle inicial del dashboard. Los KPIs (servidor) pintan al instante; las
// gráficas cargan después con un esqueleto. Mejora notable en celular.
// Nota: next/dynamic exige que las opciones sean un objeto literal en línea.
function Skeleton() {
  return <div className="h-[220px] w-full animate-pulse rounded-lg bg-zinc-100" />;
}

export const VentasDiaChart = dynamic(
  () => import("./Charts").then((m) => m.VentasDiaChart),
  { ssr: false, loading: Skeleton },
);
export const MetodoChart = dynamic(
  () => import("./Charts").then((m) => m.MetodoChart),
  { ssr: false, loading: Skeleton },
);
export const TopProductosChart = dynamic(
  () => import("./Charts").then((m) => m.TopProductosChart),
  { ssr: false, loading: Skeleton },
);
export const PacientesFaseChart = dynamic(
  () => import("./Charts").then((m) => m.PacientesFaseChart),
  { ssr: false, loading: Skeleton },
);
export const PorMesChart = dynamic(
  () => import("./Charts").then((m) => m.PorMesChart),
  { ssr: false, loading: Skeleton },
);
export const IngresosMesChart = dynamic(
  () => import("./Charts").then((m) => m.IngresosMesChart),
  { ssr: false, loading: Skeleton },
);
