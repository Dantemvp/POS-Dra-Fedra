import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { perfilCalendario, configuracionGoogle } from '@/lib/google-calendario-servidor';
import { CALLBACK, GOOGLE_EMAIL, POS_ORIGIN, cifrar, scopesSoloLectura, validarEstado } from '@/lib/google-calendario-seguridad';

export const maxDuration = 60;
export async function GET(request: Request) {
  const jar = await cookies();
  const estadoGuardado = jar.get('fedra_google_ro')?.value;
  jar.delete({ name: 'fedra_google_ro', path: '/api/google-calendario' });
  const regresar = (estado: string) => NextResponse.redirect(`${POS_ORIGIN}/agenda?google=${estado}`, { headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
  try {
    const perfil = await perfilCalendario();
    if (!perfil || !['admin', 'doctora'].includes(perfil.rol)) return regresar('permiso');
    const url = new URL(request.url);
    if (url.origin !== POS_ORIGIN || !estadoGuardado) return regresar('autorizacion');
    const { id, secreto } = configuracionGoogle();
    const estado = validarEstado(estadoGuardado, secreto, perfil.uid, url.searchParams.get('state') ?? '');
    const code = url.searchParams.get('code');
    if (!code || url.searchParams.has('error')) return regresar('cancelado');
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(12_000),
      body: new URLSearchParams({ client_id: id, client_secret: secreto, code, redirect_uri: CALLBACK, grant_type: 'authorization_code', code_verifier: estado.verifier }),
    });
    if (!res.ok) return regresar('autorizacion');
    const token = await res.json();
    if (!scopesSoloLectura(token.scope) || typeof token.refresh_token !== 'string' || typeof token.access_token !== 'string') return regresar('alcance');
    const identidad = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${token.access_token}` }, cache: 'no-store', signal: AbortSignal.timeout(12_000) });
    if (!identidad.ok) return regresar('cuenta');
    const cuenta = await identidad.json();
    if (cuenta.verified_email !== true || cuenta.email?.toLowerCase() !== GOOGLE_EMAIL) return regresar('cuenta');
    const { error } = await createAdminClient().from('google_calendar_conexion').upsert({ id: true, refresh_token: cifrar(token.refresh_token, secreto), access_token: null, expiry: null, email: GOOGLE_EMAIL, calendar_id: 'primary', conectado_por: perfil.id, conectado_en: new Date().toISOString(), actualizado_en: new Date().toISOString() });
    return regresar(error ? 'guardado' : 'conectado');
  } catch {
    return regresar('autorizacion');
  }
}
