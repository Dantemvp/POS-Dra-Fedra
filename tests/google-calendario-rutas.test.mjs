import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { cifrar, descifrar, CALENDAR_SCOPE, GOOGLE_EMAIL, POS_ORIGIN, CALLBACK, OAUTH_COOKIE_PATH } from '../src/lib/google-calendario-seguridad.ts';

async function ruta(t, archivo, perfil, respuestas = []) {
  const llave = `__google_${crypto.randomUUID().replaceAll('-', '')}`;
  const escrituras = [], cookies = new Map(), opcionesCookies = new Map(), eliminadas = [], consultas = [];
  const config = { id: 'cliente-ficticio', secreto: 'secreto-ficticio' };
  const externo = {
    perfilCalendario: async () => perfil,
    configuracionGoogle: () => config,
    leerMesGoogle: async () => { consultas.push('agenda'); return { conectado: false, eventos: [] }; },
    cookies: async () => ({ get: nombre => cookies.has(nombre) ? { value: cookies.get(nombre) } : undefined, set: (nombre, valor, opciones) => { cookies.set(nombre, valor); opcionesCookies.set(nombre, opciones); }, delete: ({ name, path }) => { eliminadas.push({ name, path }); cookies.delete(name); } }),
    NextResponse: { json: (datos, opciones) => Response.json(datos, opciones), redirect: (url, opciones) => new Response(null, { status: 307, headers: { Location: String(url), ...opciones?.headers } }) },
    createAdminClient: () => ({ from: tabla => ({ upsert: async datos => { escrituras.push({ tabla, datos }); return { error: null }; } }) }),
  };
  globalThis[llave] = externo;
  t.after(() => { delete globalThis[llave]; });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opciones) => { consultas.push({ url, opciones }); return Response.json(respuestas.shift()); };
  t.after(() => { globalThis.fetch = originalFetch; });
  const rutaArchivo = archivo === 'callback' ? 'google/oauth/callback' : `google-calendario/${archivo}`;
  let fuente = fs.readFileSync(new URL(`../src/app/api/${rutaArchivo}/route.ts`, import.meta.url), 'utf8');
  fuente = fuente.replace(/import \{ ([^}]+) \} from '[^']+';/g, (texto, nombres) => {
    if (texto.includes('google-calendario-seguridad')) return `import { ${nombres} } from ${JSON.stringify(new URL('../src/lib/google-calendario-seguridad.ts', import.meta.url).href)};`;
    if (texto.includes('node:crypto')) return texto;
    return `const { ${nombres} } = globalThis.${llave};`;
  });
  const codigo = ts.transpileModule(fuente, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const modulo = await import(`data:text/javascript;base64,${Buffer.from(codigo).toString('base64')}`);
  return { GET: modulo.GET, escrituras, cookies, opcionesCookies, eliminadas, consultas };
}
const admin = { id: 'usuario-base', uid: 'sesion-ficticia', rol: 'admin' };
function estado(r, uid = admin.uid) {
  r.cookies.set('fedra_google_ro', cifrar(JSON.stringify({ uid, state: 'csrf', exp: Date.now() + 600_000, verifier: 'pkce-ficticio' }), 'secreto-ficticio', 'state'));
}
const callback = () => new Request(`${CALLBACK}?state=csrf&code=ficticio`);

test('Google conectar: rechaza asistente y sesión ausente sin iniciar OAuth', async t => {
  for (const perfil of [null, { ...admin, rol: 'asistente' }]) {
    const r = await ruta(t, 'conectar', perfil);
    assert.equal((await r.GET(new Request(`${POS_ORIGIN}/api/google-calendario/conectar`))).status, 403);
    assert.equal(r.cookies.size, 0);
    assert.equal(r.consultas.length, 0);
  }
});

test('Google conectar: pide lectura, consentimiento nuevo y PKCE desde el dominio real', async t => {
  const r = await ruta(t, 'conectar', admin);
  const respuesta = await r.GET(new Request(`${POS_ORIGIN}/api/google-calendario/conectar`));
  const destino = new URL(respuesta.headers.get('location'));
  assert.equal(destino.origin, 'https://accounts.google.com');
  assert.equal(destino.searchParams.get('scope'), `openid email ${CALENDAR_SCOPE}`);
  assert.equal(destino.searchParams.get('include_granted_scopes'), 'false');
  assert.equal(destino.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(destino.searchParams.get('redirect_uri'), `${POS_ORIGIN}/api/google/oauth/callback`);
  const opciones = r.opcionesCookies.get('fedra_google_ro');
  assert.equal(opciones.path, OAUTH_COOKIE_PATH);
  assert.ok(new URL(destino.searchParams.get('redirect_uri')).pathname.startsWith(`${opciones.path}/`));
  assert.equal(opciones.httpOnly, true);
  assert.equal(opciones.secure, true);
  assert.equal(opciones.sameSite, 'lax');
  assert.ok(r.cookies.get('fedra_google_ro').startsWith('ro1.'));
  assert.equal((await r.GET(new Request('https://otro-dominio.invalid/api/google-calendario/conectar'))).status, 400);
});

test('Google callback: rechaza estado de otra sesión antes de intercambiar el código', async t => {
  const r = await ruta(t, 'callback', admin);
  estado(r, 'otra-sesion');
  const respuesta = await r.GET(callback());
  assert.match(respuesta.headers.get('location'), /google=autorizacion$/);
  assert.equal(r.consultas.length, 0);
  assert.equal(r.escrituras.length, 0);
  assert.equal(r.cookies.size, 0);
});

test('Google callback: rechaza un token con escritura sin guardar conexión', async t => {
  const r = await ruta(t, 'callback', admin, [{ scope: `${CALENDAR_SCOPE} https://www.googleapis.com/auth/calendar`, refresh_token: 'ficticio', access_token: 'ficticio' }]);
  estado(r);
  assert.match((await r.GET(callback())).headers.get('location'), /google=alcance$/);
  assert.equal(r.escrituras.length, 0);
});

test('Google callback: rechaza otra cuenta sin almacenar tokens', async t => {
  const r = await ruta(t, 'callback', admin, [{ scope: CALENDAR_SCOPE, refresh_token: 'ficticio', access_token: 'ficticio' }, { email: 'otra@example.invalid', verified_email: true }]);
  estado(r);
  assert.match((await r.GET(callback())).headers.get('location'), /google=cuenta$/);
  assert.equal(r.escrituras.length, 0);
});

test('Google callback: guarda solo el token cifrado y consume el estado', async t => {
  const r = await ruta(t, 'callback', admin, [{ scope: CALENDAR_SCOPE, refresh_token: 'refresh-ficticio', access_token: 'access-ficticio' }, { email: GOOGLE_EMAIL, verified_email: true }]);
  estado(r);
  const respuesta = await r.GET(callback());
  assert.match(respuesta.headers.get('location'), /google=conectado$/);
  const datos = r.escrituras[0].datos;
  assert.equal(datos.access_token, null);
  assert.equal(datos.expiry, null);
  assert.equal(datos.conectado_por, admin.id);
  assert.equal(descifrar(datos.refresh_token, 'secreto-ficticio'), 'refresh-ficticio');
  assert.equal(r.consultas[0].opciones.body.get('code_verifier'), 'pkce-ficticio');
  assert.equal(r.consultas[0].opciones.body.get('redirect_uri'), `${POS_ORIGIN}/api/google/oauth/callback`);
  assert.deepEqual(r.eliminadas, [{ name: 'fedra_google_ro', path: OAUTH_COOKIE_PATH }]);
  assert.equal(r.cookies.size, 0);
  assert.match((await r.GET(callback())).headers.get('location'), /google=autorizacion$/);
  assert.equal(r.escrituras.length, 1);
});

test('Google eventos: rechaza sesión ausente y no consulta con mes inválido', async t => {
  const prohibida = await ruta(t, 'eventos', null);
  assert.equal((await prohibida.GET(new Request(`${POS_ORIGIN}/api/google-calendario/eventos?mes=2026-10`))).status, 403);
  assert.equal(prohibida.consultas.length, 0);
  const permitida = await ruta(t, 'eventos', admin);
  assert.equal((await permitida.GET(new Request(`${POS_ORIGIN}/api/google-calendario/eventos?mes=2026-13`))).status, 400);
  assert.equal(permitida.consultas.length, 0);
  const respuesta = await permitida.GET(new Request(`${POS_ORIGIN}/api/google-calendario/eventos?mes=2026-10`));
  assert.equal(respuesta.headers.get('cache-control'), 'private, no-store');
});
