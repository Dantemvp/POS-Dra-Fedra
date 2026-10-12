import test from 'node:test';
import assert from 'node:assert/strict';
import { cargarTS } from './helpers/modulo-ts.mjs';

async function api(t, rol, opciones={}) {
  const consultas=[];
  const perfil=rol?{rol,authUid:'usuario-ficticio'}:null;
  const db={from(tabla){
    const llamada={tabla,filtros:[],campos:''};consultas.push(llamada);
    const devolver=()=>{
      if(tabla==='usuarios')return {data:opciones.sinPerfil?null:{rol,activo:!opciones.inactivo},error:null};
      if(opciones.falla===tabla)return {error:{message:'error ficticio'},data:null};
      if(tabla==='cortes_caja')return {data:{id:'corte-ficticio',cierre:new Date().toISOString(),diferencia:-5},error:null};
      const data=tabla==='citas'?[{id:'cita-ficticia',tipo:'cita_paciente',estado:'agendada',fecha_hora:new Date(Date.now()+10000).toISOString(),paciente:{id:'paciente-ficticio',nombre:'Persona ficticia',apellidos:null,telefono_wpp:null}}]:[];
      return {data,error:null,count:opciones.exceso===tabla?2000:data.length};
    };
    const q={select(campos){llamada.campos=campos;return q;},eq(...f){llamada.filtros.push(['eq',...f]);return q;},gte(...f){llamada.filtros.push(['gte',...f]);return q;},gt(...f){llamada.filtros.push(['gt',...f]);return q;},lt(...f){llamada.filtros.push(['lt',...f]);return q;},lte(...f){llamada.filtros.push(['lte',...f]);return q;},not(...f){llamada.filtros.push(['not',...f]);return q;},order(){return q;},limit(){return q;},single:async()=>devolver(),maybeSingle:async()=>devolver(),then(resolve,reject){return Promise.resolve(devolver()).then(resolve,reject);}};
    return q;
  }};
  const {modulo,limpiar}=await cargarTS(new URL('../src/app/api/panel-operativo/route.ts',import.meta.url),{
    'next/server':{NextResponse:{json:(d,o)=>Response.json(d,o)}},'@/lib/auth':{getUsuarioActual:async()=>perfil},'@/lib/supabase/server':{createClient:async()=>db},
    '@/lib/panel-operativo':{stockPanel:()=>({bajo:0,vencido:0,porCaducar:0,sinCodigo:0,sinPrecio:0})},
  });
  t.after(limpiar);return {GET:modulo.GET,consultas};
}
test('panel API: sin sesión, rol desconocido, perfil ausente o inactivo se rechazan',async t=>{
  for(const [rol,opts] of [[null,{}],['inventado',{}],['asistente',{sinPerfil:true}],['asistente',{inactivo:true}]]) {
    const a=await api(t,rol,opts);assert.equal((await a.GET()).status,403);assert.ok(a.consultas.every(c=>c.tabla==='usuarios'));
  }
});
test('panel API: Farmacia no consulta expedientes, citas ni cobros del consultorio',async t=>{
  const a=await api(t,'farmacia');const res=await a.GET();const d=await res.json();
  assert.equal(res.status,200);assert.deepEqual(d.citas,[]);assert.ok(d.stock);assert.ok(!a.consultas.some(c=>['citas','cobros','pacientes'].includes(c.tabla)));
  assert.match(res.headers.get('cache-control'),/private, no-store/);
});
test('panel API: asistente recibe agenda, nunca inventario, ventas o cortes',async t=>{
  const a=await api(t,'asistente');const d=await(await a.GET()).json();assert.equal(d.citas[0].nombre,'Persona ficticia');assert.equal(d.stock,undefined);assert.equal(d.caja,undefined);
  assert.ok(a.consultas.every(c=>['usuarios','citas'].includes(c.tabla)));
});
test('panel API: doctora conserva ruta autorizada a cortes y no recibe inventario',async t=>{
  const a=await api(t,'doctora');const d=await(await a.GET()).json();assert.equal(d.caja.href,'/cortes');assert.equal(d.stock,undefined);assert.ok(!a.consultas.some(c=>['productos','ventas'].includes(c.tabla)));
});
test('panel API: error o truncamiento devuelve 503, no falsos contadores cero',async t=>{
  for(const opciones of [{falla:'citas'},{exceso:'citas'},{falla:'productos'},{exceso:'productos'}]){
    const a=await api(t,'admin',opciones);const res=await a.GET();assert.equal(res.status,503);assert.equal((await res.json()).citas,undefined);
  }
});
