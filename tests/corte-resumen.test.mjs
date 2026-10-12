import test from 'node:test';
import assert from 'node:assert/strict';
import { resumenCorte, csvCorte, guardarDesgloseCorte, leerDesgloseCorte } from '../src/lib/corte-resumen.ts';

test('corte: pagos mixtos suman por método, centavos exactos y pacientes únicos',()=>{
  const res=resumenCorte([{total:0.30,metodo_pago:'efectivo',pagos:[{metodo:'efectivo',monto:0.10},{metodo:'tarjeta',monto:0.20}],venta_items:[{cantidad:2}]}],
    [{total:1.01,paciente_id:'p1',cobro_pagos:[{metodo:'efectivo',monto:1.01}]},{total:2,paciente_id:'p1',cobro_pagos:[{metodo:'transferencia',monto:2}]}]);
  assert.equal(res.efectivoEsperado,1.11); assert.equal(res.diferenciaPagos,0);assert.equal(res.pacientesAtendidos,1);assert.equal(res.productosSalidos,2);
  assert.deepEqual(res.desglose,{efectivo:1.11,tarjeta:0.20,transferencia:2});
});
test('corte: venta vieja sin pagos conserva método y detecta cobro sin pago',()=>{
  assert.equal(resumenCorte([{total:'100.00',metodo_pago:'efectivo',pagos:[],venta_items:[]}],[]).efectivoEsperado,100);
  assert.equal(resumenCorte([],[{total:100,paciente_id:null,cobro_pagos:[]}]).diferenciaPagos,100);
  assert.throws(()=>resumenCorte([{total:NaN,metodo_pago:'efectivo',pagos:[],venta_items:[]}],[]),/Importe inválido/);
});
test('CSV del corte conserva resumen guardado, métodos, Sinaloa y contado sin inventar cero',()=>{
  const csv=csvCorte({id:'ficticio',fecha:'11/10/2026 18:30 Sinaloa',responsable:'=FÓRMULA()',totalVentas:100,totalCobros:200,efectivoEsperado:50,efectivoContado:null,diferencia:null,productos:2,pacientes:1,desglose:{efectivo:50,tarjeta:250}});
  assert.match(csv,/Pago: Tarjeta/);assert.match(csv,/'=FÓRMULA\(\)/);assert.match(csv,/Sin capturar/);assert.match(csv,/Sinaloa/);assert.match(csv,/300.00/);assert.ok(csv.startsWith('\uFEFF'));
});
test('alcance guardado sobrevive reimpresión sin convertirse en método ni dinero',()=>{
  for(const incluido of [true,false]){
    const guardado=guardarDesgloseCorte({efectivo:100,tarjeta:50},incluido);
    const leido=leerDesgloseCorte(JSON.parse(JSON.stringify(guardado)));
    assert.deepEqual(leido.desglose,{efectivo:100,tarjeta:50});
    assert.equal(leido.consultorioIncluido,incluido);
    assert.equal(leido.area,incluido ? undefined : 'farmacia');
  }
  const anterior=leerDesgloseCorte({efectivo:100});
  assert.deepEqual(anterior.desglose,{efectivo:100});
  assert.equal(anterior.consultorioIncluido,undefined);
  assert.equal(anterior.area,undefined);
});
test('CSV de farmacia dice no incluido, no inventa pacientes ni exporta metadatos como pagos',()=>{
  const csv=csvCorte({fecha:'11/10/2026',responsable:'Ficticio',totalVentas:100,totalCobros:0,efectivoEsperado:100,efectivoContado:100,diferencia:0,productos:2,pacientes:0,...leerDesgloseCorte(guardarDesgloseCorte({efectivo:100},false))});
  assert.match(csv,/"Consultorio","No incluido en este corte"/);assert.match(csv,/"Pacientes atendidos","No incluido en este corte"/);
  assert.doesNotMatch(csv,/__solo_farmacia/);assert.match(csv,/"Total","100.00"/);
});
