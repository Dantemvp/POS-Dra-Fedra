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

export function mensajeCita({ nombre, fecha, tipo, politicas = '', diaCompleto = false, motivo = '', generico = false }: { nombre: string; fecha: string; tipo: TipoMensajeCita; politicas?: string; diaCompleto?: boolean; motivo?: string; generico?: boolean }) {
  const cuando = fechaMensajeCita(fecha, diaCompleto);
  if ((!nombre.trim() && !generico) || !cuando) return '';
  const asunto = motivo.trim() ? ` de ${motivo.trim()}` : '';
  const inicio = tipo === 'agendamiento' ? `Gracias por agendar tu cita${asunto} con la Dra. Fedra Aldama para el ${cuando}.` : `Te escribimos del consultorio de la Dra. Fedra Aldama para confirmar tu cita${asunto}, el ${cuando}.`;
  return [nombre.trim() ? `Hola, buen día, ${nombre.trim()}.` : 'Hola, buen día.', inicio, '¿Nos confirmas si podrás asistir?', politicas.trim()].filter(Boolean).join('\n\n');
}

export function enlacesWhatsApp(telefono: string, mensaje: string) {
  const numero = numeroWhatsApp(telefono);
  if (!numero || !mensaje.trim()) return null;
  const texto = encodeURIComponent(mensaje.trim());
  return { app: `https://wa.me/${numero}?text=${texto}`, web: `https://web.whatsapp.com/send?phone=${numero}&text=${texto}` };
}
