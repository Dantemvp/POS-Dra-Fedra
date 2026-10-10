import test from 'node:test';
import assert from 'node:assert/strict';
import { CALENDAR_SCOPE, cifrar, descifrar, validarEstado, scopesSoloLectura, eventosDelMes } from '../src/lib/google-calendario-seguridad.ts';

test('Google: cifra tokens y rechaza alteraciones, claves distintas y tokens viejos', () => {
  const cifrado = cifrar('token-de-prueba', 'secreto-ficticio');
  assert.ok(!cifrado.includes('token-de-prueba'));
  assert.equal(descifrar(cifrado, 'secreto-ficticio'), 'token-de-prueba');
  assert.throws(() => descifrar(cifrado, 'otro-secreto'));
  assert.throws(() => descifrar(cifrado, 'secreto-ficticio', 'state'));
  assert.throws(() => descifrar(cifrado.slice(0, -4) + 'AAAA', 'secreto-ficticio'));
  assert.throws(() => descifrar('refresh-viejo', 'secreto-ficticio'), /Reconecta/);
});

test('Google: estado ligado a sesión, aleatorio y con vencimiento', () => {
  const ahora = 1000;
  const estado = cifrar(JSON.stringify({ uid: 'usuario', state: 'aleatorio', exp: ahora + 600_000, verifier: 'pkce' }), 'prueba', 'state');
  assert.equal(validarEstado(estado, 'prueba', 'usuario', 'aleatorio', ahora).verifier, 'pkce');
  assert.throws(() => validarEstado(estado, 'prueba', 'otro-usuario', 'aleatorio', ahora));
  assert.throws(() => validarEstado(estado, 'prueba', 'usuario', 'otro-estado', ahora));
  assert.throws(() => validarEstado(estado, 'prueba', 'usuario', 'aleatorio', ahora + 600_001));
});

test('Google: nunca acepta permisos de escritura o correo', () => {
  assert.equal(scopesSoloLectura(`${CALENDAR_SCOPE} openid https://www.googleapis.com/auth/userinfo.email`), true);
  for (const scope of [undefined, '', 'openid email', `${CALENDAR_SCOPE} https://www.googleapis.com/auth/calendar`, `${CALENDAR_SCOPE} https://www.googleapis.com/auth/gmail.readonly`]) {
    assert.equal(scopesSoloLectura(scope), false);
  }
});

test('Google: pagina por GET, acota el mes en Sinaloa y conserva eventos de todo el día', async () => {
  const consultas = [];
  const eventos = await eventosDelMes('token-ficticio', '2026-12', 'primary', async (url, opciones) => {
    consultas.push({ url, opciones });
    return Response.json(consultas.length === 1 ? { items: [{ id: '1', summary: 'Consulta ficticia', start: { dateTime: '2026-12-01T09:00:00-07:00' } }, { id: 'cancelado', status: 'cancelled' }], nextPageToken: 'pagina-2' } : { items: [{ id: '2', start: { date: '2026-12-02' } }] });
  });
  assert.equal(consultas.length, 2);
  assert.equal(consultas[0].url.searchParams.get('timeMin'), '2026-12-01T00:00:00-07:00');
  assert.equal(consultas[0].url.searchParams.get('timeMax'), '2027-01-01T00:00:00-07:00');
  assert.equal(consultas[1].url.searchParams.get('pageToken'), 'pagina-2');
  assert.equal(consultas[0].opciones.method, undefined);
  assert.equal(consultas[0].opciones.cache, 'no-store');
  assert.deepEqual(eventos.map(e => e.id), ['1', '2']);
  assert.equal(eventos[1].diaCompleto, true);
});

test('Google: errores no se presentan como agenda vacía y el mes se valida antes de consultar', async () => {
  await assert.rejects(eventosDelMes('ficticio', '2026-13', 'primary', () => { throw new Error('No debe consultar'); }), /Mes inválido/);
  await assert.rejects(eventosDelMes('ficticio', '2026-10', 'primary', async () => new Response('', { status: 403 })), /No se pudo consultar/);
  await assert.rejects(eventosDelMes('ficticio', '2026-10', 'primary', async () => Response.json({ error: 'Prueba' })), /inválida/);
});

test('Google: demasiadas páginas fallan en lugar de mostrar un mes incompleto', async () => {
  let llamadas = 0;
  await assert.rejects(eventosDelMes('ficticio', '2026-10', 'primary', async () => {
    llamadas++;
    return Response.json({ items: [], nextPageToken: 'más' });
  }), /Demasiados eventos/);
  assert.equal(llamadas, 20);
});
