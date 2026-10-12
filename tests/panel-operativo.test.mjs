import test from 'node:test';
import assert from 'node:assert/strict';
import { cargarTS } from './helpers/modulo-ts.mjs';
import { crearLecturaGoogle } from '../src/lib/google-lectura-compartida.ts';
const { modulo: { avisosPanel, stockPanel, claveAvisoInventario }, limpiar } = await cargarTS(new URL('../src/lib/panel-operativo.ts', import.meta.url));
test.after(limpiar);
const ahora = new Date('2026-10-12T01:30:00Z');
const cita = { id:'pos1', tipo:'cita_paciente', estado:'agendada', origen:'pos', fecha_hora:'2026-10-12T02:30:00Z', nombre:'Persona ficticia', paciente_id:'ficticio', telefono_wpp:null };
test('campana: separa POS y Google; no afirma que Google esté por confirmar', () => {
  const google = {...cita, id:'google1', origen:'google', contactos_google:[{nombre:'Persona Uno',telefono:null},{nombre:'Persona Dos',telefono:'+526681234567'}]};
  const avisos = avisosPanel({ actualizado:ahora.toISOString(), citas:[cita,google]}, ahora);
  assert.equal(avisos.find(a=>a.id==='agenda-hoy').cantidad, 2);
  assert.equal(avisos.find(a=>a.id==='agenda-confirmar').cantidad, 1);
  assert.equal(avisos.find(a=>a.id==='agenda-telefono').cantidad, 2);
  assert.ok(avisos.every(a=>a.area==='consultorio'));
});
test('campana: no agrega citas pasadas ni confirmaciones de eventos administrativos', () => {
  const avisos=avisosPanel({ actualizado:ahora.toISOString(), citas:[{...cita, fecha_hora:'2026-10-11T01:00:00Z'}, {...cita, tipo:'evento', telefono_wpp:'6681234567'}]},ahora);
  assert.equal(avisos.some(a=>a.id==='agenda-confirmar'||a.id==='agenda-telefono'),false);
});
test('campana separa cierres por área y no duplica el aviso general de compatibilidad',()=>{
  const avisos=avisosPanel({actualizado:ahora.toISOString(),citas:[],caja:{sinCorte:99,ultimaDiferencia:10,href:'/caja'},cajas:[{area:'farmacia',sinCorte:0,ultimaDiferencia:0,href:'/caja'},{area:'consultorio',sinCorte:2,ultimaDiferencia:-5,href:'/cobros/corte'}]},ahora);
  assert.equal(avisos.length,2);assert.ok(avisos.every(a=>a.area==='consultorio'&&a.href==='/cobros/corte'));assert.ok(!avisos.some(a=>a.id==='caja-abierta'));
});
test('stock: caducidad de hoy no está vencida por UTC; ignora lotes vacíos', () => {
  const s=stockPanel([{precio_venta:0,codigo_barras:null,stock_minimo:10,lotes:[{cantidad_actual:3,caducidad:'2026-10-10'},{cantidad_actual:1,caducidad:'2026-10-11'},{cantidad_actual:0,caducidad:'2020-01-01'}]}],ahora);
  assert.deepEqual(s,{bajo:1,vencido:1,porCaducar:1,sinCodigo:1,sinPrecio:1});
  const a=avisosPanel({actualizado:ahora.toISOString(),citas:[],stock:s,caja:{sinCorte:3,ultimaDiferencia:-10,href:'/caja'}},ahora);
  assert.equal(a[0].nivel,'urgente');
  assert.equal(a.find(a=>a.id==='caja-diferencia').area,'sistema');
  assert.ok(a.every(a=>a.href.startsWith('/inventario?aviso=')||a.href==='/caja'));
  assert.equal(claveAvisoInventario('vencido'),'vencido');assert.equal(claveAvisoInventario('__proto__'),null);assert.equal(claveAvisoInventario('desconocido'),null);
});
test('lectura compartida: dos consumidores hacen un solo request y caduca en memoria', async () => {
  let cuenta=0, reloj=0;
  const leer=crearLecturaGoogle(async()=>{cuenta++;return {conectado:true,eventos:[]};},()=>reloj);
  const [a,b]=await Promise.all([leer('2026-10'),leer('2026-10')]);
  assert.equal(cuenta,1); assert.equal(a,b);
  reloj=4999; await leer('2026-10'); assert.equal(cuenta,1);
  reloj=5001; await leer('2026-10'); assert.equal(cuenta,2);
  await leer('2026-11'); assert.equal(cuenta,3);
});
test('lectura compartida: un error no se conserva como agenda vacía ni cruza proveedores', async()=>{
  let cuenta=0;
  const leer=crearLecturaGoogle(async()=>{if(++cuenta===1)throw new Error('sin conexión');return {conectado:true,eventos:[]};});
  await assert.rejects(leer('2026-10'),/sin conexión/);
  await leer('2026-10');assert.equal(cuenta,2);
  await crearLecturaGoogle(async()=>{cuenta++;return {conectado:true,eventos:[]};})('2026-10');assert.equal(cuenta,3);
});
