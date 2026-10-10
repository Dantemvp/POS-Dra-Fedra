'use client';

import { useId, useState } from 'react';
import { enlacesWhatsApp, fechaMensajeCita, mensajeCita, type TipoMensajeCita } from '@/lib/agenda-whatsapp';

type Props = { nombre?: string; telefono?: string | null; fecha: string; diaCompleto?: boolean; google?: boolean };

export function FormularioWhatsApp({ nombre = '', telefono = '', fecha, diaCompleto = false, google = false }: Props) {
  const id = useId();
  const [persona, setPersona] = useState(nombre);
  const [numero, setNumero] = useState(telefono ?? '');
  const [tipo, setTipo] = useState<TipoMensajeCita>('recordatorio');
  const [politicas, setPoliticas] = useState('');
  const [editado, setEditado] = useState<string | null>(null);
  const base = mensajeCita({ nombre: persona, fecha, tipo, politicas, diaCompleto });
  const mensaje = editado ?? base;
  const enlaces = persona.trim() && fechaMensajeCita(fecha, diaCompleto) ? enlacesWhatsApp(numero, mensaje) : null;
  const campo = 'mt-1 min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900';
  const boton = 'inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold';
  return <div className="mt-3 min-w-0 space-y-3 rounded-xl border border-zinc-300 bg-white p-3 text-sm text-zinc-800">
    <p className="font-semibold">Revisar mensaje antes de abrir WhatsApp</p>
    <p className="break-words text-zinc-600">{fechaMensajeCita(fecha, diaCompleto) ?? 'La cita no tiene una fecha válida.'}</p>
    {google && <p className="text-zinc-600">Confirme el nombre y teléfono del destinatario. El título de Google no identifica automáticamente a un paciente.</p>}
    <div className="grid gap-3 sm:grid-cols-2">
      <label htmlFor={`${id}-nombre`}>Nombre de la persona<input id={`${id}-nombre`} value={persona} onChange={e => { setPersona(e.target.value); setEditado(null); }} autoComplete="off" className={campo} placeholder="Nombre para el saludo" /></label>
      <label htmlFor={`${id}-telefono`}>WhatsApp<input id={`${id}-telefono`} type="tel" inputMode="tel" value={numero} onChange={e => setNumero(e.target.value)} autoComplete="off" className={campo} placeholder="10 dígitos o número internacional" /></label>
    </div>
    <label className="block" htmlFor={`${id}-tipo`}>Tipo de mensaje<select id={`${id}-tipo`} value={tipo} onChange={e => { setTipo(e.target.value as TipoMensajeCita); setEditado(null); }} className={campo}><option value="recordatorio">Recordar y solicitar confirmación</option><option value="agendamiento">Gracias por agendar</option></select></label>
    <label className="block" htmlFor={`${id}-politicas`}>Políticas de reagendación (opcional)<textarea id={`${id}-politicas`} rows={2} value={politicas} onChange={e => { setPoliticas(e.target.value); setEditado(null); }} className={campo} placeholder="Pegue aquí el texto que autorice el consultorio" /></label>
    <p className="text-xs text-zinc-600">Borrador de prueba. Fer aún debe proporcionar el texto definitivo y las políticas. No agregamos plazos ni cargos por cancelación.</p>
    <label className="block" htmlFor={`${id}-mensaje`}>Mensaje editable<textarea id={`${id}-mensaje`} rows={8} value={mensaje} onChange={e => setEditado(e.target.value)} className={`${campo} resize-y`} placeholder="Complete el nombre para generar el mensaje" /></label>
    <div className="flex flex-wrap gap-2">
      {enlaces ? <><a href={enlaces.app} target="_blank" rel="noopener noreferrer" className={`${boton} bg-green-700 text-white hover:bg-green-800`}>Abrir WhatsApp</a><a href={enlaces.web} target="_blank" rel="noopener noreferrer" className={`${boton} border border-zinc-300 hover:bg-zinc-100`}>WhatsApp Web</a></> : <button type="button" disabled className={`${boton} bg-zinc-100 text-zinc-500`}>Complete nombre, teléfono y mensaje</button>}
      {editado !== null && <button type="button" onClick={() => setEditado(null)} className={`${boton} border border-zinc-300`}>Restablecer borrador</button>}
    </div>
    <p className="text-xs text-zinc-600">Revise el destinatario en WhatsApp y pulse Enviar allí. Abrir el chat no envía el mensaje ni confirma la cita. Este borrador solo vive en esta pantalla.</p>
  </div>;
}

export default function RecordatorioWhatsApp(props: Props) {
  const [abierto, setAbierto] = useState(false);
  const id = useId();
  return <div className="mt-3 min-w-0">
    <button type="button" aria-expanded={abierto} aria-controls={id} onClick={() => setAbierto(!abierto)} className="min-h-11 rounded-lg border border-green-700 px-4 py-2 text-sm font-semibold text-green-800 dark:text-green-300 dark:border-green-500 hover:bg-green-50 dark:hover:bg-zinc-800">{abierto ? 'Cerrar mensaje' : 'Preparar WhatsApp'}</button>
    {abierto && <div id={id}><FormularioWhatsApp {...props} /></div>}
  </div>;
}
