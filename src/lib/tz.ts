// Utilidades de zona horaria. Toda la operación es en Los Mochis, Sinaloa,
// que usa UTC-7 todo el año (sin horario de verano). El servidor (Vercel)
// corre en UTC, así que NUNCA hay que usar la hora local del servidor para
// fronteras de "día": eso desfasaría los cortes de caja 7 horas.

export const TZ = "America/Mazatlan";
export const OFFSET_SINALOA = "-07:00";

// Fecha calendario (YYYY-MM-DD) de un instante, en hora de Sinaloa.
export function ymdSinaloa(d: string | Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(d));
}

// Instante exacto del inicio (00:00) del día de Sinaloa al que pertenece `d`.
export function inicioDiaSinaloa(d: Date = new Date()): Date {
  return new Date(`${ymdSinaloa(d)}T00:00:00${OFFSET_SINALOA}`);
}

// Etiqueta corta "DD/MM" del día en hora de Sinaloa (para agrupar/graficar).
export function etiquetaDiaCorta(d: string | Date): string {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(d));
}

// Hora "HH:MM" en Sinaloa (para mostrar la hora real de una venta/cita).
export function horaSinaloa(d: string | Date): string {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(d));
}

// Fecha "DD/MM/AAAA" en Sinaloa.
export function fechaSinaloa(d: string | Date): string {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(d));
}
