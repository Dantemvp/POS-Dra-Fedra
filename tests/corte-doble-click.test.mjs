import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cargarTS } from './helpers/modulo-ts.mjs';
test('cerrar corte: dos clics antes del siguiente render producen una sola llamada',async t=>{
  let indice=0,llamadas=0;
  const promesas=[];
  const estados=['100',null,null,false,false];
  const react={...React,useState:()=>[estados[indice++],()=>{}],useRef:()=>({current:false}),useTransition:()=>[false,f=>promesas.push(f())]};
  const {modulo,limpiar}=await cargarTS(new URL('../src/app/(app)/caja/CorteDelDia.tsx',import.meta.url),{
    react,'./actions':{registrarCorte:async()=>{llamadas++;await Promise.resolve();return {ok:true,corte:{id:'ficticio'}};}},'@/components/CorteComprobante':()=>null,
  });
  t.after(limpiar);
  const arbol=modulo.default({numVentas:1,totalVentas:100,totalCobros:0,productosSalidos:1,pacientesAtendidos:0,efectivoEsperado:100,desglose:{efectivo:100},fecha:'Ficticia',responsable:'Ficticio'});
  function boton(n){if(!n||typeof n!=='object')return null;if(n.type==='button'&&n.props.children==='Cerrar corte e imprimir')return n;return React.Children.toArray(n.props?.children).map(boton).find(Boolean);}
  const cerrar=boton(arbol);assert.ok(cerrar);cerrar.props.onClick();cerrar.props.onClick();await Promise.all(promesas);assert.equal(llamadas,1);
});
