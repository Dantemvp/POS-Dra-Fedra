import type { EventoGoogle } from './google-calendario-seguridad';

export const ZONA_AGENDA = 'America/Mazatlan';
const formatoDia = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_AGENDA, year: 'numeric', month: '2-digit', day: '2-digit' });
const formatoHora = new Intl.DateTimeFormat('es-MX', { timeZone: ZONA_AGENDA, hour: 'numeric', minute: '2-digit' });
export type CitaCalendario = {
  id: string; fecha_hora: string; estado: string; tipo: string;
  paciente_id: string | null; nombre: string;
  origen?: 'pos' | 'google'; dia_completo?: boolean;
  fecha_fin?: string; descripcion?: string; ubicacion?: string; url?: string; telefono_wpp?: string | null;
};
export function diaAgenda(fecha: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fecha;
  return formatoDia.format(new Date(fecha));
}
export function horaAgenda(cita: CitaCalendario) {
  if (cita.dia_completo) return 'Todo el día';
  return formatoHora.format(new Date(cita.fecha_hora));
}
function instante(cita: CitaCalendario) {
  return Date.parse(cita.dia_completo ? `${cita.fecha_hora}T00:00:00-07:00` : cita.fecha_hora);
}
export function unirAgenda(citas: CitaCalendario[], eventos: EventoGoogle[]): CitaCalendario[] {
  // Nunca ligar por nombre ni ocultar eventos distintos de las dos fuentes.
  const google = new Map(eventos.map(e => [e.id, {
    id: `google:${e.id}`, fecha_hora: e.inicio, fecha_fin: e.fin,
    estado: 'Solo lectura', tipo: 'google', origen: 'google' as const,
    paciente_id: null, nombre: e.titulo, dia_completo: e.diaCompleto,
    descripcion: e.descripcion, ubicacion: e.ubicacion, url: e.url,
  }]));
  return [...citas.map(c => ({ ...c, origen: 'pos' as const })), ...google.values()];
}
export function agruparAgenda(citas: CitaCalendario[], mes: string) {
  const grupos = new Map<string, CitaCalendario[]>();
  const [ano, numero] = mes.split('-').map(Number);
  const total = new Date(ano, numero, 0).getDate();
  for (const cita of citas) {
    const inicio = diaAgenda(cita.fecha_hora);
    // Google usa fin exclusivo para fechas sin hora.
    const fin = cita.fecha_fin
      ? diaAgenda(new Date(Date.parse(cita.dia_completo ? `${cita.fecha_fin}T00:00:00-07:00` : cita.fecha_fin) - 1).toISOString())
      : inicio;
    for (let n = 1; n <= total; n++) {
      const dia = `${mes}-${String(n).padStart(2, '0')}`;
      if (dia >= inicio && dia <= fin) {
        if (!grupos.has(dia)) grupos.set(dia, []);
        grupos.get(dia)!.push(cita);
      }
    }
  }
  for (const lista of grupos.values()) lista.sort((a, b) => Number(Boolean(b.dia_completo)) - Number(Boolean(a.dia_completo)) || instante(a) - instante(b));
  return grupos;
}
export function proximasAgenda(citas: CitaCalendario[], ahora = new Date()) {
  const hoy = diaAgenda(ahora.toISOString());
  return citas.filter(c => {
    if (['cancelada', 'atendida', 'cedida'].includes(c.estado)) return false;
    if (c.dia_completo) return c.fecha_fin ? c.fecha_fin > hoy : c.fecha_hora >= hoy;
    return Date.parse(c.fecha_fin ?? c.fecha_hora) >= ahora.getTime();
  }).sort((a, b) => instante(a) - instante(b));
}
