import type { EventoGoogle } from './google-calendario-seguridad';

export const ZONA_AGENDA = 'America/Mazatlan';
const formatoDia = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_AGENDA, year: 'numeric', month: '2-digit', day: '2-digit' });
const formatoHora = new Intl.DateTimeFormat('es-MX', { timeZone: ZONA_AGENDA, hour: 'numeric', minute: '2-digit' });
export type CitaCalendario = {
  id: string; fecha_hora: string; estado: string; tipo: string;
  paciente_id: string | null; nombre: string;
  origen?: 'pos' | 'google'; dia_completo?: boolean;
  fecha_fin?: string; descripcion?: string; ubicacion?: string; url?: string; telefono_wpp?: string | null;
  nombre_contacto?: string; adelanto_google?: string; contacto_ambiguo?: boolean;
  invitados?: EventoGoogle['invitados']; campos?: EventoGoogle['campos'];
};

export function datosContactoGoogle(e: EventoGoogle) {
  // Solo datos de la cita. No consultar expedientes ni convertir importes en pagos.
  const texto = [e.titulo, e.descripcion ?? '', ...(e.invitados ?? []).map(i => i.comentario ?? ''),
    ...(e.campos ?? []).map(c => `${c.clave}: ${c.valor}`)].join('\n')
    .replace(/<br\s*\/?\s*>|<\/(?:p|div)>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ');
  const valores = (etiquetas: string) => Array.from(texto.matchAll(new RegExp(`(?:^|\\n)\\s*(?:${etiquetas})\\s*[:=]\\s*([^\\n]+)`, 'gi')), m => m[1].trim());
  const nombres = [...new Set(valores('nombre(?: completo)?|paciente'))];
  const telefonos = valores('tel[eé]fono|tel|celular|cel|whatsapp|wpp|phone').map(valor => {
    if (!/^[+\d\s().-]+$/.test(valor)) return null;
    let n = valor.replace(/\D/g, '');
    if (n.length === 10 && !valor.trim().startsWith('+')) n = `52${n}`;
    if (/^521\d{10}$/.test(n)) n = `52${n.slice(3)}`;
    return /^[1-9]\d{10,14}$/.test(n) ? n : null;
  }).filter((n): n is string => Boolean(n));
  const unicos = [...new Set(telefonos)];
  const adelantos = [...new Set(valores('anticipo|adelanto|abono|deposito|depósito'))];
  // Convención confirmada por Fer: el importe al final del título es el anticipo.
  const importeTitulo = e.titulo.match(/\$\s*\d[\d,]*(?:\.\d{1,2})?\s*(?:\([^)]*\))?\s*$/);
  if (importeTitulo) adelantos.push(importeTitulo[0].match(/\$\s*\d[\d,]*(?:\.\d{1,2})?/)![0]);
  const nombreTitulo = importeTitulo ? e.titulo.slice(0, importeTitulo.index).trim().replace(/[-:|\s]+$/, '') : '';
  if (!nombres.length && nombreTitulo && !/[\/&;]|\s+y\s+/i.test(nombreTitulo)) nombres.push(nombreTitulo);
  const ambiguo = nombres.length > 1 || unicos.length > 1;
  return { nombre_contacto: !ambiguo && nombres.length === 1 ? nombres[0] : undefined,
    telefono_wpp: !ambiguo && unicos.length === 1 ? `+${unicos[0]}` : null,
    adelanto_google: adelantos.length ? adelantos.join(' / ') : undefined,
    contacto_ambiguo: ambiguo };
}
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
    invitados: e.invitados, campos: e.campos, ...datosContactoGoogle(e),
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
