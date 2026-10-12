import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { cargarTS } from './helpers/modulo-ts.mjs';
const {modulo,limpiar}=await cargarTS(new URL('../src/components/CorteComprobante.tsx',import.meta.url),{'./AutoPrint':()=>React.createElement('span',{'data-impresion-automatica':'si'})});
test.after(limpiar);
const corte={id:'corte-ficticio',fecha:'11/10/2026',responsable:'Responsable ficticio',apertura:'2026-10-11T07:00:00Z',cierre:'2026-10-12T01:30:00Z',totalVentas:100,totalCobros:50,efectivoEsperado:100,efectivoContado:90,diferencia:-10,productos:2,pacientes:1,desglose:{efectivo:100,tarjeta:50}};
test('ticket de corte: papel del driver, área de 72 mm, negro, folio, métodos, faltante y firmas',()=>{
  const html=renderToStaticMarkup(React.createElement(modulo.default,{corte}));
  for(const texto of ['CORTE DE CAJA','corte-ficticio','Responsable ficticio','Tarjeta','Faltante','Firma de quien entrega','Firma de quien recibe','No es comprobante de venta.'])assert.ok(html.includes(texto),texto);
  assert.match(html,/print-area ticket-print ticket-thermal-strong ticket-corte/);
  assert.match(html,/@page \{ size: auto; margin: 0; \}/);assert.match(html,/width: 72mm/);assert.match(html,/color: #000 !important/);assert.match(html,/margin: 0 auto !important/);
  assert.doesNotMatch(html,/data-impresion-automatica/);
});
test('ticket clínico omite farmacia y productos, conserva desglose y papel claro',()=>{
  const html=renderToStaticMarkup(React.createElement(modulo.default,{corte:{...corte,area:'consultorio',farmaciaIncluida:false,consultorioIncluido:true,totalVentas:0,productos:0}}));
  assert.match(html,/Farmacia: no incluida/);assert.match(html,/Pacientes atendidos/);assert.doesNotMatch(html,/Productos salidos/);assert.match(html,/doc-imprimible/);assert.match(html,/Consultorio/);
});
test('ticket previo no se identifica como guardado ni imprime automáticamente',()=>{
  const html=renderToStaticMarkup(React.createElement(modulo.default,{corte:{...corte,id:undefined},automatico:true}));
  assert.match(html,/VISTA PREVIA, SIN GUARDAR/);assert.doesNotMatch(html,/data-impresion-automatica/);assert.match(html,/Imprimir vista previa/);
});
test('ticket guardado habilita impresión automática y reimprimir nunca llama cierre',()=>{
  const html=renderToStaticMarkup(React.createElement(modulo.default,{corte,automatico:true}));
  assert.match(html,/data-impresion-automatica/);assert.match(html,/Reimprimir corte/);assert.doesNotMatch(html,/registrarCorte|Cerrar corte/);
});
test('ticket farmacia con cobros invisibles declara consultorio excluido y omite contador clínico',()=>{
  const html=renderToStaticMarkup(React.createElement(modulo.default,{corte:{...corte,totalCobros:0,pacientes:0,consultorioIncluido:false}}));
  assert.match(html,/Consultorio: no incluido en este corte/);assert.doesNotMatch(html,/Pacientes atendidos|<span>Consultorio<\/span>/);
  assert.match(html,/Total registrado/);
});
