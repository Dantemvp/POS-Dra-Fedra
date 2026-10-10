import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { CALENDAR_SCOPE, GOOGLE_EMAIL, descifrar, eventosDelMes, scopesSoloLectura } from './google-calendario-seguridad';

export async function perfilCalendario() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('usuarios').select('id, rol').eq('auth_uid', user.id).single();
  if (!data || !['admin', 'doctora', 'gerente', 'asistente'].includes(data.rol)) return null;
  return { id: data.id as string, uid: user.id, rol: data.rol as string };
}
export function configuracionGoogle() {
  const id = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const secreto = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!id || !secreto) throw new Error('Falta configurar Google Calendar.');
  return { id, secreto };
}
export async function leerMesGoogle(mes: string) {
  // Siempre comprobar la sesión antes de usar la llave que omite RLS.
  if (!await perfilCalendario()) throw new Error('No tienes permiso para consultar la agenda.');
  const admin = createAdminClient();
  const { data, error } = await admin.from('google_calendar_conexion').select('refresh_token, email, calendar_id').eq('id', true).maybeSingle();
  if (error) throw new Error('No se pudo comprobar la conexión con Google.');
  if (!data || data.email?.toLowerCase() !== GOOGLE_EMAIL || !data.refresh_token.startsWith('ro1.')) {
    return { conectado: false as const, eventos: [] };
  }
  const { id, secreto } = configuracionGoogle();
  const respuesta = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(12_000),
    body: new URLSearchParams({ client_id: id, client_secret: secreto, refresh_token: descifrar(data.refresh_token, secreto), grant_type: 'refresh_token' }),
  });
  if (!respuesta.ok) throw new Error('Google no permitió actualizar la agenda. Reconecta la cuenta.');
  const token = await respuesta.json();
  if (!scopesSoloLectura(token.scope) || typeof token.access_token !== 'string') throw new Error('La conexión no tiene permisos exclusivamente de lectura. Reconecta Google.');
  const eventos = await eventosDelMes(token.access_token, mes, data.calendar_id);
  return { conectado: true as const, eventos, actualizado: new Date().toISOString(), scope: CALENDAR_SCOPE };
}
