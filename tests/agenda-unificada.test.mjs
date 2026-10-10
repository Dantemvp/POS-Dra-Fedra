import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { agruparAgenda, diaAgenda, horaAgenda, unirAgenda, proximasAgenda } from '../src/lib/agenda-vista.ts';
import { iniciarRefrescoAgenda } from '../src/lib/agenda-refresco.ts';
import { eventosDelMes } from '../src/lib/google-calendario-seguridad.ts';

const local = { id: 'uno', nombre: 'Persona ficticia', fecha_hora: '2026-10-11T09:00:00-07:00', paciente_id: 'paciente-ficticio', estado: 'agendada', tipo: 'cita_paciente' };
const externo = { id: 'uno', titulo: 'Persona ficticia', inicio: '2026-10-11T10:00:00-07:00', diaCompleto: false, descripcion: 'Teléfono de prueba', ubicacion: 'Consultorio ficticio' };
test('agenda: distingue fuentes, conserva datos y no liga Google por nombre', () => {
  const citas = unirAgenda([local], [externo, externo]);
  assert.equal(citas.length, 2);
  assert.deepEqual(citas.map(c => c.id), ['uno', 'google:uno']);
  assert.equal(citas[1].paciente_id, null);
  assert.equal(citas[1].descripcion, externo.descripcion);
  assert.equal(citas[1].ubicacion, externo.ubicacion);
  assert.equal(citas[0].paciente_id, local.paciente_id);
});
test('agenda: reemplazar la lectura refleja cambios y eliminaciones sin duplicar', () => {
  const primera = unirAgenda([local], [externo]);
  const segunda = unirAgenda([local], [{ ...externo, inicio: '2026-10-12T10:00:00-07:00' }]);
  assert.equal(agruparAgenda(primera, '2026-10').get('2026-10-11').length, 2);
  assert.equal(agruparAgenda(segunda, '2026-10').get('2026-10-11').length, 1);
  assert.equal(agruparAgenda(segunda, '2026-10').get('2026-10-12').length, 1);
  assert.equal(unirAgenda([local], []).length, 1);
});
test('agenda: fechas sin hora no retroceden de día y usa hora de Sinaloa', () => {
  assert.equal(diaAgenda('2026-10-11'), '2026-10-11');
  assert.equal(diaAgenda('2026-10-11T03:00:00Z'), '2026-10-10');
  assert.equal(horaAgenda({ ...local, dia_completo: true }), 'Todo el día');
});
test('agenda: varios días, fin exclusivo y cruce de mes', () => {
  const citas = unirAgenda([], [{ ...externo, inicio: '2026-09-30', fin: '2026-10-03', diaCompleto: true }]);
  assert.deepEqual([...agruparAgenda(citas, '2026-10').keys()], ['2026-10-01', '2026-10-02']);
  const medianoche = [{ ...local, fecha_hora: '2026-10-11T23:00:00-07:00', fecha_fin: '2026-10-12T00:00:00-07:00' }];
  assert.deepEqual([...agruparAgenda(medianoche, '2026-10').keys()], ['2026-10-11']);
});
test('agenda: próximas excluye pasadas/cerradas y ordena instantes con offsets distintos', () => {
  const citas = [local, { ...local, id: 'cancelada', estado: 'cancelada' }, { ...local, id: 'pasada', fecha_hora: '2026-10-09T09:00:00-07:00' }, { ...local, id: 'utc', fecha_hora: '2026-10-11T15:00:00Z' }];
  assert.deepEqual(proximasAgenda(citas, new Date('2026-10-10T12:00:00-07:00')).map(c => c.id), ['utc', 'uno']);
});
test('Google: conserva fin, notas y ubicación sin ofrecer enlaces externos', async () => {
  const eventos = await eventosDelMes('ficticio', '2026-10', 'primary', async () => Response.json({ items: [{ id: '1', start: { date: '2026-10-11' }, end: { date: '2026-10-12' }, description: '<script>texto de prueba</script>', location: 'Prueba', htmlLink: 'https://calendar.google.com/calendar/event?eid=ficticio' }, { id: '2', start: { date: '2026-10-12' }, htmlLink: 'javascript:alert(1)' }] }));
  assert.equal(eventos[0].fin, '2026-10-12');
  assert.equal(eventos[0].descripcion, '<script>texto de prueba</script>');
  assert.equal(eventos[0].ubicacion, 'Prueba');
  assert.ok(eventos[0].url.startsWith('https://calendar.google.com/'));
  assert.equal(eventos[1].url, undefined);
});

function arnes(consultar, visible = 'visible') {
  const documento = new EventTarget(); documento.visibilityState = visible;
  const ventana = new EventTarget();
  const recibidos = [], errores = [], cargas = [];
  let tick, intervalo, cancelado = false;
  const ciclo = iniciarRefrescoAgenda({ documento, ventana, consultar, recibir: d => recibidos.push(d), fallar: e => errores.push(e), cargando: v => cargas.push(v), programar: (f, ms) => { tick = f; intervalo = ms; return () => { cancelado = true; }; } });
  return { ciclo, documento, ventana, recibidos, errores, cargas, tick: () => tick(), intervalo, cancelado: () => cancelado };
}
test('refresco: al montar, cada 60 segundos y al recuperar foco', async () => {
  let n = 0; const a = arnes(async () => ++n);
  await setImmediate(); assert.deepEqual(a.recibidos, [1]); assert.equal(a.intervalo, 60_000);
  a.tick(); await setImmediate();
  a.ventana.dispatchEvent(new Event('focus')); await setImmediate();
  assert.deepEqual(a.recibidos, [1, 2, 3]); a.ciclo.detener();
});
test('refresco: pausa oculto y actualiza al volver sin requests simultáneos', async () => {
  let resolver, n = 0;
  const a = arnes(() => { n++; return new Promise(r => { resolver = r; }); }, 'hidden');
  a.tick(); assert.equal(n, 0);
  a.documento.visibilityState = 'visible'; a.documento.dispatchEvent(new Event('visibilitychange'));
  a.tick(); a.ventana.dispatchEvent(new Event('focus')); assert.equal(n, 1);
  resolver('nuevo'); await setImmediate(); assert.deepEqual(a.recibidos, ['nuevo']); a.ciclo.detener();
});
test('refresco: aborta al ocultar y no aplica respuestas viejas al cambiar mes', async () => {
  let resolver, signal;
  const a = arnes(s => { signal = s; return new Promise(r => { resolver = r; }); });
  a.documento.visibilityState = 'hidden'; a.documento.dispatchEvent(new Event('visibilitychange'));
  assert.equal(signal.aborted, true); resolver('viejo'); await setImmediate(); assert.deepEqual(a.recibidos, []);
  a.ciclo.detener(); assert.equal(a.cancelado(), true);
  a.documento.visibilityState = 'visible'; a.documento.dispatchEvent(new Event('visibilitychange')); a.tick();
  assert.deepEqual(a.recibidos, []);
});
test('refresco: un error no borra la lectura y se recupera en el siguiente intervalo', async () => {
  let n = 0; const a = arnes(async () => { if (++n === 2) throw new Error('sin conexión'); return n; });
  await setImmediate(); a.tick(); await setImmediate();
  assert.deepEqual(a.recibidos, [1]); assert.equal(a.errores.length, 1);
  a.tick(); await setImmediate(); assert.deepEqual(a.recibidos, [1, 3]); a.ciclo.detener();
});
