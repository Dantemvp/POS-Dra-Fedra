import type { EventoGoogle } from './google-calendario-seguridad';

export const ZONA_AGENDA = 'America/Mazatlan';
export type ContactoAgendaGoogle = { nombre: string; telefono: string | null; adelanto?: string; ambiguo?: boolean };
const formatoDia = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_AGENDA, year: 'numeric', month: '2-digit', day: '2-digit' });
const formatoHora = new Intl.DateTimeFormat('es-MX', { timeZone: ZONA_AGENDA, hour: 'numeric', minute: '2-digit' });
export type CitaCalendario = {
  id: string; fecha_hora: string; estado: string; tipo: string;
  paciente_id: string | null; nombre: string;
  origen?: 'pos' | 'google'; dia_completo?: boolean;
  fecha_fin?: string; descripcion?: string; ubicacion?: string; url?: string; telefono_wpp?: string | null;
  nombre_contacto?: string; adelanto_google?: string; contacto_ambiguo?: boolean;
  invitados?: EventoGoogle['invitados']; campos?: EventoGoogle['campos'];
  contactos_google?: ContactoAgendaGoogle[];
};

function textoCita(valor: string) {
  return valor.replace(/<a\b[^>]*href=["'](https:\/\/(?:wa\.me\/\d+|api\.whatsapp\.com\/send\?[^"']+))["'][^>]*>/gi, '$1 ')
    .replace(/<br\s*\/?\s*>|<\/(?:p|div|li)>/gi, '\n').replace(/<[^>]*>/g, '')
    .replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"');
}
const etiquetasContacto = 'nombre(?: completo)?|paciente|tel[eé]fono|tel|celular|cel|whatsapp|wpp|phone|anticipo|adelanto|abono|dep[oó]sito';
function valoresCita(texto: string, etiquetas: string) {
  return Array.from(texto.matchAll(new RegExp(`(?:^|[\\n;,]|\\s)\\s*(?:${etiquetas})\\s*[:=]\\s*([^\\n]*?)(?=\\s+(?:${etiquetasContacto})\\s*[:=]|[\\n;]|$)`, 'gi')), m => m[1].trim());
}
function telefonosCita(texto: string) {
  const sinImportes = texto.replace(/\$\s*\d[\d,]*(?:\.\d{1,2})?/g, '');
  const candidatos = [...sinImportes.matchAll(/(?<![\w$])\+?\d[\d ().-]*\d(?!\w)/g)].map(m => m[0]);
  candidatos.push(...Array.from(texto.matchAll(/(?:wa\.me\/|[?&]phone=)(\d{10,15})/gi), m => m[1]));
  return [...new Set(candidatos.flatMap(valor => {
    let n = valor.replace(/\D/g, '');
    if (n.length === 10 && !valor.trim().startsWith('+')) n = `52${n}`;
    if (/^521\d{10}$/.test(n)) n = `52${n.slice(3)}`;
    return /^[1-9]\d{10,14}$/.test(n) ? [`+${n}`] : [];
  }))];
}
function partesTitulo(titulo: string) {
  // La barra dentro de (P/S) es un código, no otra persona.
  let nivel = 0;
  let inicio = 0;
  const partes: string[] = [];
  for (let i = 0; i < titulo.length; i++) {
    if (titulo[i] === '(') nivel++;
    if (titulo[i] === ')') nivel = Math.max(0, nivel - 1);
    if (titulo[i] === '/' && nivel === 0) { partes.push(titulo.slice(inicio, i)); inicio = i + 1; }
  }
  partes.push(titulo.slice(inicio));
  return partes.flatMap(p => p.split(/\s+y\s+/i));
}
function nombreDelTitulo(titulo: string) {
  if (/\b(vuelo|capacitaci[oó]n|inaugura\w*|fumigaci[oó]n\w*|cumplea[ñn]os|fiesta|ceremonia|airbnb|abnb|check\s*out)\b/i.test(titulo)) return '';
  const nombre = titulo.replace(/\$\s*\d[\d,]*(?:\.\d{1,2})?/g, '')
    .replace(/\([a-z,*\s/]{1,8}\)/gi, '')
    .replace(/(?:tel[eé]fono|tel|celular|cel|whatsapp|wpp|phone)\s*[:=].*$/i, '')
    .replace(/(?<!\w)\+?\d[\d ().-]*\d(?!\w)/g, '')
    .replace(/\b(facial|xeomeen|xeomin|botox|inbody|consulta|valoraci[oó]n|seguimiento|control|l[aá]ser)\b/gi, '')
    .replace(/(?:[\s,]+[snr]\b)+\s*$/i, '').replace(/^[\s,:|-]+|[\s,:|-]+$/g, '').replace(/\s+/g, ' ').trim();
  return /^[\p{L}\s.'-]+$/u.test(nombre) && nombre.split(/\s+/).length >= 2 ? nombre : '';
}
export function contactosGoogle(e: EventoGoogle): ContactoAgendaGoogle[] {
  // Datos de agenda solamente: nunca liga expedientes ni crea movimientos de caja.
  const notas = textoCita([e.descripcion ?? '', ...(e.invitados ?? []).filter(i => !i.organizador && !i.propio && !i.recurso).map(i => i.comentario ?? ''),
    ...(e.campos ?? []).map(c => `${c.clave}: ${c.valor}`)].join('\n'));
  const nombresNotas = [...new Set(valoresCita(notas, 'nombre(?: completo)?|paciente'))];
  const partes = partesTitulo(textoCita(e.titulo)).map(parte => ({ parte, nombre: nombreDelTitulo(parte) })).filter(p => p.nombre);
  const nombres = nombresNotas.length ? nombresNotas : partes.map(p => p.nombre);
  const bloques = notas.split(/(?=(?:^|\n)\s*(?:nombre(?: completo)?|paciente)\s*[:=])/i);
  return [...new Set(nombres)].map(nombre => {
    const parte = partes.find(p => p.nombre.toLowerCase() === nombre.toLowerCase())?.parte ?? (nombres.length === 1 ? e.titulo : '');
    // Una nota compartida con varios destinatarios no se atribuye a ninguno sin nombre explícito.
    const nota = nombres.length === 1 ? notas : bloques.find(b => valoresCita(b, 'nombre(?: completo)?|paciente').includes(nombre)) ?? '';
    const telefonos = telefonosCita(`${parte}\n${nota}`);
    const importes = [...new Set([...valoresCita(nota, 'anticipo|adelanto|abono|dep[oó]sito'),
      ...Array.from(parte.matchAll(/\$\s*\d[\d,]*(?:\.\d{1,2})?/g), m => m[0])])];
    return { nombre, telefono: telefonos.length === 1 ? telefonos[0] : null,
      adelanto: importes.length === 1 ? importes[0] : undefined, ambiguo: telefonos.length > 1 || importes.length > 1 };
  });
}
export function datosContactoGoogle(e: EventoGoogle) {
  const contactos = contactosGoogle(e);
  const unico = contactos.length === 1 ? contactos[0] : undefined;
  // También conservar un número explícito cuando la cita no permite extraer nombre.
  const telefonos = contactos.length ? [] : telefonosCita(textoCita([e.titulo, e.descripcion ?? '', ...(e.campos ?? []).map(c => c.valor)].join('\n')));
  return { nombre_contacto: unico?.nombre, telefono_wpp: unico?.telefono ?? (telefonos.length === 1 ? telefonos[0] : null),
    adelanto_google: unico?.adelanto, contacto_ambiguo: contactos.some(c => c.ambiguo) || telefonos.length > 1,
    contactos_google: contactos };
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
