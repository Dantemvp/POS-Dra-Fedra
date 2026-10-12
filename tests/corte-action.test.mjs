import test from 'node:test';
import assert from 'node:assert/strict';
import { cargarTS } from './helpers/modulo-ts.mjs';
const base={totalVentas:999999,totalCobros:999999,efectivoEsperado:999999,efectivoContado:150,diferencia:999999,totalProductos:99,pacientesAtendidos:99,desglose:{efectivo:999999}};
const resumen={apertura:'2026-10-11T07:00:00Z',cierre:'2026-10-12T01:30:00Z',totalVentas:100,totalCobros:50,efectivoEsperado:100,productosSalidos:2,pacientesAtendidos:1,numVentas:1,desglose:{efectivo:100,tarjeta:50},diferenciaPagos:0};
async function accion(t,rol='farmacia',fallo=false,gap=0) {
  const escrituras=[];
  const cliente={auth:{getUser:async()=>({data:{user:{id:'auth'}}})},from(tabla){return {select(){return this;},eq(){return this;},insert(row){escrituras.push(row);return this;},async single(){return tabla==='usuarios'?{data:{id:'actor',rol,activo:true}}:{data:{id:'corte-ficticio'},error:null};}};}};
  const {modulo,limpiar}=await cargarTS(new URL('../src/app/(app)/caja/actions.ts',import.meta.url),{'next/cache':{revalidatePath(){}},'@/lib/auth':{getUsuarioActual:async()=>rol?{rol,nombre:'Responsable ficticio'}:null},'@/lib/supabase/server':{createClient:async()=>cliente},'@/lib/caja-lectura':{leerCajaDia:async()=>{if(fallo)throw new Error('Datos incompletos');return {...resumen,diferenciaPagos:gap};}}});
  t.after(limpiar);return {cerrar:modulo.registrarCorte,escrituras};
}
test('cierre usa importes del servidor, ignora los montos manipulados y devuelve folio para imprimir',async t=>{
  const a=await accion(t);const r=await a.cerrar(base);assert.equal(r.ok,true);assert.equal(r.corte.id,'corte-ficticio');assert.equal(r.corte.diferencia,50);
  assert.equal(a.escrituras[0].total_ventas,100);assert.equal(a.escrituras[0].total_efectivo,100);assert.deepEqual(a.escrituras[0].desglose,{efectivo:100,tarjeta:50});
});
test('cierre rechaza sin sesión, asistente/doctora, contado inválido y lectura incompleta sin insertar',async t=>{
  for(const rol of [null,'asistente','doctora']){const a=await accion(t,rol);assert.equal((await a.cerrar(base)).ok,false);assert.equal(a.escrituras.length,0);}
  for(const n of [null,-1,NaN,Infinity,1.001]){const a=await accion(t);assert.equal((await a.cerrar({...base,efectivoContado:n})).ok,false);assert.equal(a.escrituras.length,0);}
  for(const [fallo,gap] of [[true,0],[false,10]]){const a=await accion(t,'farmacia',fallo,gap);assert.equal((await a.cerrar(base)).ok,false);assert.equal(a.escrituras.length,0);}
});
