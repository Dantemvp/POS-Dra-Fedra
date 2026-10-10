import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
export const GOOGLE_EMAIL = 'drafedraaldama@gmail.com';
export const POS_ORIGIN = 'https://sistema-fedra.vercel.app';
// Conservar el retorno usado por el cliente OAuth desde junio de 2026.
export const CALLBACK = `${POS_ORIGIN}/api/google/oauth/callback`;
export const OAUTH_COOKIE_PATH = '/api/google/oauth';

// Claves separadas por propósito. Cambiar el secreto OAuth requiere reconectar.
function clave(secreto: string, proposito: string) {
  if (!secreto) throw new Error('Falta configuración de Google.');
  return createHash('sha256').update(`fedra:google:lectura:v1:${proposito}:`).update(secreto).digest();
}
export function cifrar(texto: string, secreto: string, proposito = 'refresh') {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', clave(secreto, proposito), iv);
  const datos = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
  return `ro1.${Buffer.concat([iv, cipher.getAuthTag(), datos]).toString('base64url')}`;
}
export function descifrar(texto: string, secreto: string, proposito = 'refresh') {
  if (!texto.startsWith('ro1.')) throw new Error('Reconecta Google en modo lectura.');
  const datos = Buffer.from(texto.slice(4), 'base64url');
  if (datos.length < 29) throw new Error('Conexión inválida.');
  const cipher = createDecipheriv('aes-256-gcm', clave(secreto, proposito), datos.subarray(0, 12));
  cipher.setAuthTag(datos.subarray(12, 28));
  return Buffer.concat([cipher.update(datos.subarray(28)), cipher.final()]).toString('utf8');
}
export function scopesSoloLectura(scope: unknown) {
  if (typeof scope !== 'string') return false;
  const scopes = scope.split(/\s+/).filter(Boolean);
  const permitidos = new Set([CALENDAR_SCOPE, 'openid', 'email', 'https://www.googleapis.com/auth/userinfo.email']);
  return scopes.includes(CALENDAR_SCOPE) && scopes.every(s => permitidos.has(s));
}
export function validarEstado(texto: string, secreto: string, uid: string, estado: string, ahora = Date.now()) {
  const datos = JSON.parse(descifrar(texto, secreto, 'state'));
  if (datos.uid !== uid || datos.state !== estado || typeof datos.exp !== 'number' || datos.exp < ahora || datos.exp > ahora + 600_000 || typeof datos.verifier !== 'string') {
    throw new Error('Autorización vencida o inválida.');
  }
  return datos as { uid: string; state: string; exp: number; verifier: string };
}

export type EventoGoogle = { id: string; titulo: string; inicio: string; diaCompleto: boolean; fin?: string; descripcion?: string; ubicacion?: string; url?: string };
// Solo GET, mes acotado y todas las páginas. Un error no se disfraza de agenda vacía.
export async function eventosDelMes(accessToken: string, mes: string, calendario = 'primary', pedir: typeof fetch = fetch): Promise<EventoGoogle[]> {
  if (!/^20\d\d-(0[1-9]|1[0-2])$/.test(mes)) throw new Error('Mes inválido.');
  const [ano, numero] = mes.split('-').map(Number);
  const siguiente = numero === 12 ? `${ano + 1}-01` : `${ano}-${String(numero + 1).padStart(2, '0')}`;
  const eventos: EventoGoogle[] = [];
  const vistos = new Set<string>();
  const signal = AbortSignal.timeout(20_000);
  let pagina = '';
  for (let i = 0; i < 20; i++) {
    const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendario)}/events`);
    url.search = new URLSearchParams({ timeMin: `${mes}-01T00:00:00-07:00`, timeMax: `${siguiente}-01T00:00:00-07:00`, timeZone: 'America/Mazatlan', singleEvents: 'true', orderBy: 'startTime', maxResults: '500', ...(pagina ? { pageToken: pagina } : {}) }).toString();
    const res = await pedir(url, { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store', signal });
    if (!res.ok) throw new Error('No se pudo consultar Google Calendar.');
    const cuerpo = await res.json();
    if (!Array.isArray(cuerpo.items)) throw new Error('Google devolvió una agenda inválida.');
    for (const item of cuerpo.items) {
      if (item.status === 'cancelled') continue;
      const inicio = item.start?.dateTime ?? item.start?.date;
      if (typeof item.id !== 'string' || typeof inicio !== 'string' || !Number.isFinite(Date.parse(inicio))) throw new Error('Google devolvió un evento inválido.');
      if (!vistos.has(item.id)) {
        vistos.add(item.id);
        const fin = item.end?.dateTime ?? item.end?.date;
        let url: string | undefined;
        try {
          const enlace = new URL(item.htmlLink);
          if (enlace.protocol === 'https:' && (enlace.hostname === 'calendar.google.com' || (enlace.hostname === 'www.google.com' && enlace.pathname.startsWith('/calendar/')))) url = enlace.href;
        } catch { /* Enlaces ausentes o externos no se ofrecen como acción. */ }
        eventos.push({
          id: item.id, titulo: typeof item.summary === 'string' ? item.summary : 'Sin título', inicio, diaCompleto: !item.start?.dateTime,
          ...(typeof fin === 'string' && Number.isFinite(Date.parse(fin)) ? { fin } : {}),
          ...(typeof item.description === 'string' ? { descripcion: item.description } : {}),
          ...(typeof item.location === 'string' ? { ubicacion: item.location } : {}),
          ...(url ? { url } : {}),
        });
      }
    }
    pagina = cuerpo.nextPageToken ?? '';
    if (!pagina) return eventos;
  }
  throw new Error('Demasiados eventos para mostrar el mes completo. Consulta Google Calendar.');
}
