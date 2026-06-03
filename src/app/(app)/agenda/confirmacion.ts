// Lógica compartida de confirmación de citas (sin estado de servidor, para
// poder usarla tanto en server actions como en componentes).

export const TZ = "America/Mazatlan"; // Sinaloa, UTC-7 todo el año
export const OFFSET_SINALOA = "-07:00";

// Fecha calendario (YYYY-MM-DD) de un instante, en zona de Sinaloa.
function ymdSinaloa(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

// Límite de confirmación = 1:00 pm del día PREVIO a la cita (hora de Sinaloa).
// Coincide con el comentario del esquema: "ej: 1pm del día previo".
export function limiteConfirmacion(fechaHoraISO: string): string {
  const [y, m, d] = ymdSinaloa(fechaHoraISO).split("-").map(Number);
  // Resta un día con aritmética UTC (solo importa la fecha calendario).
  const prev = new Date(Date.UTC(y, m - 1, d) - 86_400_000);
  const py = prev.getUTCFullYear();
  const pm = String(prev.getUTCMonth() + 1).padStart(2, "0");
  const pd = String(prev.getUTCDate()).padStart(2, "0");
  return `${py}-${pm}-${pd}T13:00:00${OFFSET_SINALOA}`;
}

// ¿La cita sigue pendiente de confirmar? (solo las 'agendada' lo están)
export function necesitaConfirmar(estado: string): boolean {
  return estado === "agendada";
}

// ¿Ya pasó su fecha límite de confirmación y sigue sin confirmar?
// Usa el límite guardado o, si falta (citas viejas), lo calcula al vuelo.
export function confirmacionVencida(
  estado: string,
  fechaHoraISO: string,
  limite: string | null,
  ahora: Date = new Date(),
): boolean {
  if (!necesitaConfirmar(estado)) return false;
  const lim = limite ?? limiteConfirmacion(fechaHoraISO);
  return ahora.getTime() >= new Date(lim).getTime();
}
