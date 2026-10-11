'use client';

import { useId, useState } from 'react';
import { enlacesWhatsApp, fechaMensajeCita, mensajeCita, numeroWhatsApp, type TipoMensajeCita } from '@/lib/agenda-whatsapp';

type Props = { nombre?: string; telefono?: string | null; fecha: string; diaCompleto?: boolean; google?: boolean; nombreContacto?: string; adelanto?: string };

export function FormularioWhatsApp({ nombre = '', telefono = '', fecha, diaCompleto = false, google = false, nombreContacto = '', adelanto = '' }: Props) {
  const id = useId();
  const [numero, setNumero] = useState(telefono ?? '');
  const [editarTelefono, setEditarTelefono] = useState(false);
  const [editar, setEditar] = useState(false);
  const [tipo, setTipo] = useState<TipoMensajeCita>('recordatorio');
  const [politicas, setPoliticas] = useState('');
  const [editado, setEditado] = useState<string | null>(null);
  // El nombre interpretado personaliza el saludo; no vincula un expediente clínico.
  const base = mensajeCita({ nombre: google ? nombreContacto || ' ' : nombre.trim() ? nombre : ' ', fecha, tipo, politicas, diaCompleto });
  const generico = fechaMensajeCita(fecha, diaCompleto)
    ? ['Hola.', tipo === 'agendamiento' ? 'Gracias por agendar su cita con la Dra. Fedra Aldama.' : 'Le recordamos su cita con la Dra. Fedra Aldama.',
      `Le esperamos el ${fechaMensajeCita(fecha, diaCompleto)}.`,
      'Por favor, responda a este mensaje para confirmar su asistencia.', politicas.trim(), '¡Gracias!'].filter(Boolean).join('\n\n')
    : '';
  const mensaje = editado ?? [base || generico, adelanto && (base || generico) ? `Anticipo anotado en la agenda: ${adelanto}.` : ''].filter(Boolean).join('\n\n');
  const enlaces = fechaMensajeCita(fecha, diaCompleto) ? enlacesWhatsApp(numero, mensaje) : null;
  const pedirNumero = !numeroWhatsApp(telefono ?? '') || editarTelefono;
  const campo = 'mt-1 min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900';
  const boton = 'inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold';
  return <div className="mt-3 min-w-0 space-y-2 text-sm text-zinc-800">
    {pedirNumero && <label className="block" htmlFor={`${id}-telefono`}>Número de WhatsApp<input id={`${id}-telefono`} type="tel" inputMode="tel" value={numero} onChange={e => setNumero(e.target.value)} className={campo} placeholder="10 dígitos o número internacional" autoComplete="tel" /></label>}
    <div className="flex flex-wrap items-center gap-2">
      {enlaces ? <a href={enlaces.app} target="_blank" rel="noopener noreferrer" className={`${boton} bg-green-700 text-white hover:bg-green-800`}>Enviar WhatsApp</a> : <button type="button" disabled className={`${boton} bg-zinc-100 text-zinc-500`}>Enviar WhatsApp</button>}
      {enlaces && <span className="break-all text-xs text-zinc-600">Destino: +{numeroWhatsApp(numero)}</span>}
      <button type="button" aria-expanded={editar} aria-controls={`${id}-editor`} onClick={() => setEditar(!editar)} className={`${boton} underline underline-offset-4`}>{editar ? 'Cerrar edición' : 'Editar mensaje'}</button>
      {!pedirNumero && <button type="button" onClick={() => setEditarTelefono(true)} className="min-h-11 px-2 text-xs underline">Cambiar número</button>}
    </div>
    {!fechaMensajeCita(fecha, diaCompleto) && <p role="alert">La cita no tiene una fecha válida.</p>}
    {editar && <div id={`${id}-editor`} className="space-y-3 rounded-xl border border-zinc-300 bg-white p-3">
      <label className="block" htmlFor={`${id}-mensaje`}>Mensaje<textarea id={`${id}-mensaje`} rows={7} value={mensaje} onChange={e => setEditado(e.target.value)} className={campo} /></label>
      <details><summary className="cursor-pointer py-2">Opciones del mensaje</summary>
        <label className="block" htmlFor={`${id}-tipo`}>Tipo<select id={`${id}-tipo`} value={tipo} onChange={e => { setTipo(e.target.value as TipoMensajeCita); }} className={campo}><option value="recordatorio">Recordatorio</option><option value="agendamiento">Gracias por agendar</option></select></label>
        <label className="block" htmlFor={`${id}-politicas`}>Políticas (opcional)<textarea id={`${id}-politicas`} rows={2} value={politicas} onChange={e => setPoliticas(e.target.value)} className={campo} /></label>
      </details>
      {editado !== null && <button type="button" onClick={() => setEditado(null)} className="min-h-11 underline">Restablecer mensaje base</button>}
    </div>}
    <p className="text-xs text-zinc-600">Abre el chat con el mensaje listo; pulse Enviar en WhatsApp. Abrir el chat no envía el mensaje ni confirma la cita.</p>
  </div>;
}

export default function RecordatorioWhatsApp(props: Props) {
  return <FormularioWhatsApp {...props} />;
}
