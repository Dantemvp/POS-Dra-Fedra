import test from 'node:test';
import assert from 'node:assert/strict';
import { cargarTS } from './helpers/modulo-ts.mjs';
const base={totalVentas:999999,totalCobros:999999,efectivoEsperado:999999,efectivoContado:150,diferencia:999999,totalProductos:99,pacientesAtendidos:99,desglose:{efectivo:999999}};
const resumen={apertura:'2026-10-11T07:00:00Z',cierre:'2026-10-12T01:30:00Z',totalVentas:100,totalCobros:50,efectivoEsperado:100,productosSalidos:2,pacientesAtendidos:1,numVentas:1,desglose:{efectivo:100,tarjeta:50},diferenciaPagos:0};
async function accion(t,rol='farmacia',fallo=false,gap=0) {
  const escrituras=[];
  const cliente={auth:{getUser:async()=>({data:{user:{id:'auth'}}})},from(tabla){return {select(){return this;},eq(){return this;},insert(row){escrituras.push(row);return this;},async single(){return tabla==='usuarios'?{data:{id:'actor',rol,activo:true}}:{data:{id:'corte-ficticio'},error:null};}};}};
  const areas=[];
  const {modulo,limpiar}=await cargarTS(new URL('../src/app/(app)/caja/actions.ts',import.meta.url),{'next/cache':{revalidatePath(){}},'@/lib/auth':{getUsuarioActual:async()=>rol?{rol,nombre:'Responsable ficticio'}:null},'@/lib/supabase/server':{createClient:async()=>cliente},'@/lib/caja-lectura':{leerCajaDia:async(_fecha,area)=>{areas.push(area);if(fallo)throw new Error('Datos incompletos');return {...resumen,...(area==='farmacia'?{totalCobros:0,pacientesAtendidos:0,desglose:{efectivo:100}}:{totalVentas:0,numVentas:0,productosSalidos:0,efectivoEsperado:0,desglose:{tarjeta:50}}),diferenciaPagos:gap};}}});
  t.after(limpiar);return {cerrar:modulo.registrarCorte,escrituras,areas};
}
test('cierre usa importes del servidor, ignora los montos manipulados y devuelve folio para imprimir',async t=>{
  const a=await accion(t,'admin');const r=await a.cerrar(base);assert.equal(r.ok,true);assert.equal(r.corte.id,'corte-ficticio');assert.equal(r.corte.diferencia,50);
  assert.equal(r.corte.consultorioIncluido,false);
  assert.equal(a.escrituras[0].total_ventas,100);assert.equal(a.escrituras[0].total_cobros,0);assert.equal(a.escrituras[0].total_efectivo,100);assert.deepEqual(a.escrituras[0].desglose,{efectivo:100,__solo_farmacia:1,__area_corte:1});
});
test('farmacia con cobros invisibles guarda alcance, no presenta el cero como consultorio comprobado',async t=>{
  const a=await accion(t,'farmacia',false,0);const r=await a.cerrar(base);
  assert.equal(r.ok,true);assert.equal(r.corte.consultorioIncluido,false);
  assert.equal(a.escrituras[0].total_cobros,0);assert.deepEqual(a.escrituras[0].desglose,{efectivo:100,__solo_farmacia:1,__area_corte:1});
  assert.deepEqual(r.corte.desglose,{efectivo:100});
});
test('Consultorio guarda solo cobros, área y contado propios; Farmacia no puede forzar ese cierre',async t=>{
  for(const rol of ['admin','gerente']){
    const a=await accion(t,rol);const r=await a.cerrar({...base,area:'consultorio',efectivoContado:0});
    assert.equal(r.ok,true);assert.deepEqual(a.areas,['consultorio']);assert.equal(r.corte.farmaciaIncluida,false);assert.equal(r.corte.totalVentas,0);assert.equal(r.corte.totalCobros,50);assert.equal(r.corte.diferencia,0);
    assert.deepEqual(a.escrituras[0].desglose,{tarjeta:50,__solo_farmacia:0,__area_corte:2});
  }
  for(const area of ['consultorio','ambas','inventada']){const a=await accion(t,'farmacia');assert.equal((await a.cerrar({...base,area})).ok,false);assert.equal(a.escrituras.length,0);assert.equal(a.areas.length,0);}
  const a=await accion(t,'admin');assert.equal((await a.cerrar({...base,area:'ambas'})).ok,false);assert.equal(a.escrituras.length,0);
});
test('cierre rechaza sin sesión, asistente/doctora, contado inválido y lectura incompleta sin insertar',async t=>{
  for(const rol of [null,'asistente','doctora']){const a=await accion(t,rol);assert.equal((await a.cerrar(base)).ok,false);assert.equal(a.escrituras.length,0);}
  for(const n of [null,-1,NaN,Infinity,1.001]){const a=await accion(t);assert.equal((await a.cerrar({...base,efectivoContado:n})).ok,false);assert.equal(a.escrituras.length,0);}
  for(const [fallo,gap] of [[true,0],[false,10]]){const a=await accion(t,'farmacia',fallo,gap);assert.equal((await a.cerrar(base)).ok,false);assert.equal(a.escrituras.length,0);}
});
