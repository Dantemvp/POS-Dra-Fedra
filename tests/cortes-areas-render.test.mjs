import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { cargarTS } from './helpers/modulo-ts.mjs';
import { puedeCerrarArea } from '../src/lib/corte-resumen.ts';

test('permisos existentes: farmacia no cierra clínica; doctora y asistente solo consultan',()=>{
  for(const area of ['farmacia','consultorio']){
    assert.equal(puedeCerrarArea('admin',area),true);assert.equal(puedeCerrarArea('gerente',area),true);
    for(const rol of ['doctora','asistente','inventado'])assert.equal(puedeCerrarArea(rol,area),false);
  }
  assert.equal(puedeCerrarArea('farmacia','farmacia'),true);assert.equal(puedeCerrarArea('farmacia','consultorio'),false);
});
test('resumen administrativo es de consulta y no incluye formulario ni acción de cierre',async t=>{
  for(const rol of ['admin','gerente','doctora','asistente','farmacia']){
    let lecturas=0;
    const {modulo,limpiar}=await cargarTS(new URL('../src/app/(app)/cortes/resumen/page.tsx',import.meta.url),{
      'next/link':({children,...props})=>React.createElement('a',props,children),
      'next/navigation':{redirect(){throw new Error('Sin permiso');}},
      '@/lib/auth':{getUsuarioActual:async()=>({rol,nombre:'Ficticio'})},
      '@/lib/caja-lectura':{leerCajaDia:async()=>{lecturas++;return {cierre:'2026-10-12T18:00:00Z',totalVentas:100,totalCobros:50,desglose:{efectivo:150},diferenciaPagos:0};}},
    });t.after(limpiar);
    if(['asistente','farmacia'].includes(rol)){await assert.rejects(modulo.default(),/Sin permiso/);assert.equal(lecturas,0);continue;}
    const html=renderToStaticMarkup(await modulo.default());
    assert.match(html,/150\.00/);assert.match(html,/Solo consulta/);assert.doesNotMatch(html,/<input|<form|<button|Cerrar corte/);
  }
});
test('vista clínica sin permiso de cierre no ofrece contado, edición o cierre',async t=>{
  const {modulo,limpiar}=await cargarTS(new URL('../src/app/(app)/caja/CorteDelDia.tsx',import.meta.url),{
    './actions':{registrarCorte:async()=>{throw new Error('No debe llamarse');}},
    '@/components/CorteComprobante':()=>React.createElement('div',null,'Comprobante ficticio'),
  });t.after(limpiar);
  const html=renderToStaticMarkup(React.createElement(modulo.default,{area:'consultorio',puedeCerrar:false,numVentas:0,totalVentas:0,totalCobros:50,productosSalidos:0,pacientesAtendidos:1,efectivoEsperado:50,desglose:{efectivo:50},fecha:'Ficticia',responsable:'Ficticio'}));
  assert.match(html,/Corte de Consultorio/);assert.match(html,/Administración o gerencia/);assert.doesNotMatch(html,/Cerrar corte|<input|Ventas \(farmacia\)|Productos salidos/);
  assert.match(html,/Total del área/);assert.doesNotMatch(html,/Total del día/);
});
