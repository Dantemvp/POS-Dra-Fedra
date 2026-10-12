import test from 'node:test';
import assert from 'node:assert/strict';
import { cargarTS } from './helpers/modulo-ts.mjs';
async function lectura(t,opciones={}){
  const consultas=[];
  const db={auth:{getUser:async()=>({data:{user:opciones.sinSesion?null:{id:'sesion-ficticia'}}})},from(tabla){const filtros=[];consultas.push({tabla,filtros});
    const resultado=()=>{if(opciones.falla===tabla)return {data:null,error:{message:'ficticio'}};if(tabla==='usuarios')return {data:{id:'actor-ficticio'}};if(tabla==='cortes_caja')return {data:{id:'corte-ficticio',cierre:'2026-10-12T01:30:00Z',total_ventas:100,total_cobros:0,total_efectivo:100,efectivo_contado:90,diferencia:-10,desglose:{efectivo:100,...(opciones.soloFarmacia?{__solo_farmacia:1}:{})}},error:null};return {data:[],count:opciones.exceso?1001:0,error:null};};
    const q={select(){return q;},eq(...v){filtros.push(['eq',...v]);return q;},gte(...v){filtros.push(['gte',...v]);return q;},lte(...v){filtros.push(['lte',...v]);return q;},not(...v){filtros.push(['not',...v]);return q;},order(){return q;},limit(){return q;},single:async()=>resultado(),maybeSingle:async()=>resultado(),then(resolve,reject){return Promise.resolve(resultado()).then(resolve,reject);}};return q;
  }};
  const {modulo,limpiar}=await cargarTS(new URL('../src/lib/caja-lectura.ts',import.meta.url),{'@/lib/supabase/server':{createClient:async()=>db}});t.after(limpiar);return {modulo,consultas};
}
test('leerCajaDia limita el día en Sinaloa, ventas pagadas actuales y cobros activos',async t=>{
  const a=await lectura(t);const r=await a.modulo.leerCajaDia(new Date('2026-10-12T01:30:00Z'));assert.equal(r.apertura,'2026-10-11T07:00:00.000Z');
  assert.ok(a.consultas.find(c=>c.tabla==='ventas').filtros.some(f=>f[1]==='es_historico'&&f[2]===false));
  assert.ok(a.consultas.find(c=>c.tabla==='cobros').filtros.some(f=>f[1]==='estado'&&f[2]==='activo'));
  assert.ok(a.consultas.every(c=>c.filtros.some(f=>f[0]==='lte'&&f[1]==='fecha')));
});
test('leerCajaDia rechaza lectura parcial y más movimientos que el límite',async t=>{
  for(const opts of [{falla:'ventas'},{falla:'cobros'},{exceso:true}]){const a=await lectura(t,opts);await assert.rejects(a.modulo.leerCajaDia(),/No se pudo|paginación/);}
});
test('recuperación de corte aplica el usuario de sesión, no un ID enviado por navegador',async t=>{
  const a=await lectura(t);const c=await a.modulo.leerUltimoCortePropio('Responsable ficticio');assert.equal(c.id,'corte-ficticio');assert.equal(c.efectivoContado,90);
  assert.ok(a.consultas.find(c=>c.tabla==='cortes_caja').filtros.some(f=>f[1]==='usuario_id'&&f[2]==='actor-ficticio'));
  const b=await lectura(t,{sinSesion:true});assert.equal(await b.modulo.leerUltimoCortePropio('Ficticio'),null);assert.equal(b.consultas.length,0);
});
test('recuperar corte farmacia conserva exclusión clínica y separa el metadato de los pagos',async t=>{
  const a=await lectura(t,{soloFarmacia:true});const c=await a.modulo.leerUltimoCortePropio('Ficticio');
  assert.equal(c.consultorioIncluido,false);assert.deepEqual(c.desglose,{efectivo:100});
});
test('lectura por área ni siquiera consulta las operaciones de la otra área',async t=>{
  for(const [area,tabla,opuesta] of [['farmacia','ventas','cobros'],['consultorio','cobros','ventas']]){
    const a=await lectura(t,{falla:opuesta});const r=await a.modulo.leerCajaDia(new Date(),area);
    assert.ok(a.consultas.some(c=>c.tabla===tabla));assert.ok(!a.consultas.some(c=>c.tabla===opuesta));assert.equal(r.totalVentas+r.totalCobros,0);
  }
});
test('recuperación por área filtra el metadato guardado además del autor',async t=>{
  for(const [area,codigo] of [['farmacia','1'],['consultorio','2']]){
    const a=await lectura(t);await a.modulo.leerUltimoCortePropio('Ficticio',area);
    assert.ok(a.consultas.find(c=>c.tabla==='cortes_caja').filtros.some(f=>f[1]==='desglose->>__area_corte'&&f[2]===codigo));
  }
});
