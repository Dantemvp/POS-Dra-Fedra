import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createHash, randomBytes } from 'node:crypto';
import { perfilCalendario, configuracionGoogle } from '@/lib/google-calendario-servidor';
import { CALENDAR_SCOPE, CALLBACK, GOOGLE_EMAIL, POS_ORIGIN, cifrar } from '@/lib/google-calendario-seguridad';

export async function GET(request: Request) {
  const perfil = await perfilCalendario();
  if (!perfil || !['admin', 'doctora'].includes(perfil.rol)) return NextResponse.json({ error: 'Sin permiso para conectar Google.' }, { status: 403 });
  if (new URL(request.url).origin !== POS_ORIGIN) return NextResponse.json({ error: 'La conexión se activa desde el dominio principal del POS.' }, { status: 400 });
  try {
    const { id, secreto } = configuracionGoogle();
    const state = randomBytes(32).toString('base64url');
    const verifier = randomBytes(32).toString('base64url');
    (await cookies()).set('fedra_google_ro', cifrar(JSON.stringify({ uid: perfil.uid, state, verifier, exp: Date.now() + 600_000 }), secreto, 'state'), { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/api/google-calendario' });
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({ client_id: id, redirect_uri: CALLBACK, response_type: 'code', scope: `openid email ${CALENDAR_SCOPE}`, access_type: 'offline', prompt: 'consent', include_granted_scopes: 'false', login_hint: GOOGLE_EMAIL, state, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' }).toString();
    return NextResponse.redirect(url, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.redirect(`${POS_ORIGIN}/agenda?google=configuracion`);
  }
}
