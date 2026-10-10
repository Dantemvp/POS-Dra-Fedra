export type TipoMensajeCita = 'agendamiento' | 'recordatorio';

export function numeroWhatsApp(valor: string): string | null {
  if (!/^[+\d\s().-]+$/.test(valor.trim())) return null;
  let numero = valor.replace(/\D/g, '');
  if (numero.length === 10) numero = `52${numero}`;
  // El prefijo móvil mexicano 521 de registros antiguos ya no se utiliza.
  if (/^521\d{10}$/.test(numero)) numero = `52${numero.slice(3)}`;
  return /^[1-9]\d{10,14}$/.test(numero) ? numero : null;
}

export function fechaMensajeCita(fecha: string, diaCompleto = false): string | null {
  const soloFecha = /^\d{4}-\d{2}-\d{2}$/.test(fecha);
  const instante = new Date(soloFecha ? `${fecha}T12:00:00-07:00` : fecha);
  if (!Number.isFinite(instante.getTime())) return null;
  const dia = new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mazatlan', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(instante);
  if (diaCompleto || soloFecha) return `${dia} (horario por confirmar)`;
  const hora = new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mazatlan', hour: 'numeric', minute: '2-digit', hour12: true }).format(instante);
  return `${dia} a las ${hora} (hora de Sinaloa)`;
}

export function mensajeCita({ nombre, fecha, tipo, politicas = '', diaCompleto = false }: { nombre: string; fecha: string; tipo: TipoMensajeCita; politicas?: string; diaCompleto?: boolean }) {
  const cuando = fechaMensajeCita(fecha, diaCompleto);
  if (!nombre.trim() || !cuando) return '';
  const inicio = tipo === 'agendamiento' ? 'Gracias por agendar su cita con la Dra. Fedra Aldama.' : 'Le recordamos su cita con la Dra. Fedra Aldama.';
  return [`Hola ${nombre.trim()}.`, inicio, `Le esperamos el ${cuando}.`, 'Por favor, responda a este mensaje para confirmar su asistencia.', politicas.trim(), '¡Gracias!'].filter(Boolean).join('\n\n');
}

export function enlacesWhatsApp(telefono: string, mensaje: string) {
  const numero = numeroWhatsApp(telefono);
  if (!numero || !mensaje.trim()) return null;
  const texto = encodeURIComponent(mensaje.trim());
  return { app: `https://wa.me/${numero}?text=${texto}`, web: `https://web.whatsapp.com/send?phone=${numero}&text=${texto}` };
}
