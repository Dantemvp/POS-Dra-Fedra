import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { leerMigracion, contar } from "./fixtures/nom004.mjs";

async function base() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create type metodo_pago as enum ('efectivo','tarjeta','transferencia','otro');
    create schema auth;
    create function auth.uid() returns uuid language sql as $$ select '00000000-0000-0000-0000-000000000001'::uuid $$;
    create table usuarios(id uuid,auth_uid uuid,rol text);
    insert into usuarios values('00000000-0000-0000-0000-000000000002',auth.uid(),'asistente');
    create table cobros(id uuid primary key default gen_random_uuid(), total numeric(12,2), paciente_id uuid, fecha timestamptz, nota text, doctora_id uuid);
    create table cobro_pagos(cobro_id uuid references cobros(id), metodo metodo_pago, monto numeric);
    create table cobro_items(cobro_id uuid references cobros(id), servicio_id uuid, producto_id uuid,
      descripcion text, cantidad numeric(10,2), precio_unit numeric(10,2), subtotal numeric(12,2));
    create table lotes(id uuid,producto_id uuid,cantidad_actual numeric(10,2),caducidad date,creado_en timestamptz);
    create table movimientos_inv(producto_id uuid,lote_id uuid,tipo text,cantidad numeric,motivo text,referencia_id text,usuario_id uuid);`);
  await db.exec(leerMigracion("20261008000047_cobros_pagos_mixtos.sql"));
  return db;
}
const items = JSON.stringify([{ cantidad: 1, precio_unit: 200 }]);
const pagos = JSON.stringify([{ metodo: "efectivo", monto: 70 }, { metodo: "tarjeta", monto: 130 }]);
function cobrar(db, split = pagos) {
  return db.query("select registrar_cobro_mixto(null,'efectivo','',$1::jsonb,$2::jsonb)", [items, split]);
}
test("pago mixto guarda un solo cobro y el desglose exacto", async () => {
  const db = await base();
  await cobrar(db);
  assert.equal(await contar(db,"select count(*)::int as n from cobros"),1);
  const { rows } = await db.query("select metodo,monto::int as monto from cobro_pagos order by metodo");
  assert.deepEqual(rows,[{metodo:"efectivo",monto:70},{metodo:"tarjeta",monto:130}]);
});
test("rechaza suma incorrecta, métodos repetidos y monto negativo antes de crear cobro", async () => {
  const db = await base();
  for (const split of [
    [{metodo:"efectivo",monto:70},{metodo:"tarjeta",monto:100}],
    [{metodo:"efectivo",monto:70},{metodo:"efectivo",monto:130}],
    [{metodo:"efectivo",monto:-1},{metodo:"tarjeta",monto:201}],
  ]) await assert.rejects(cobrar(db,JSON.stringify(split)));
  assert.equal(await contar(db,"select count(*)::int as n from cobros"),0);
});
test("un fallo al registrar el segundo pago revierte también el cobro", async () => {
  const db = await base();
  await db.exec(`create function rechazar_tarjeta() returns trigger language plpgsql as $$ begin
    if new.metodo='tarjeta' then raise exception 'Fallo sintético'; end if; return new; end $$;
    create trigger fallo before insert on cobro_pagos for each row execute function rechazar_tarjeta();`);
  await assert.rejects(cobrar(db),/Fallo sintético/);
  assert.equal(await contar(db,"select count(*)::int as n from cobros"),0);
  assert.equal(await contar(db,"select count(*)::int as n from cobro_pagos"),0);
});

test("cantidad decimal cuadra total, renglones y pagos sin pago provisional", async () => {
  const db = await base();
  await db.exec(`create table bitacora_pago(operacion text);
    create function auditar_pago() returns trigger language plpgsql as $$ begin
      insert into bitacora_pago values(tg_op); return null; end $$;
    create trigger auditoria after insert or delete on cobro_pagos for each row execute function auditar_pago();`);
  await db.query("select registrar_cobro_mixto(null,'efectivo','',$1::jsonb,$2::jsonb)", [
    JSON.stringify([{cantidad:1.5,precio_unit:33.33}]),
    JSON.stringify([{metodo:"efectivo",monto:20},{metodo:"tarjeta",monto:30}]),
  ]);
  const {rows} = await db.query("select total::text, (select sum(subtotal)::text from cobro_items) as items, (select sum(monto)::text from cobro_pagos) as pagos from cobros");
  assert.deepEqual(rows,[{total:"50.00",items:"50.00",pagos:"50"}]);
  assert.deepEqual((await db.query("select operacion from bitacora_pago")).rows,[{operacion:"INSERT"},{operacion:"INSERT"}]);
});

test("cobro simple suma subtotales redondeados y conserva un pago", async () => {
  const db = await base();
  await db.query("select registrar_cobro(null,'efectivo','',$1::jsonb)",[
    JSON.stringify([{cantidad:1.5,precio_unit:33.33},{cantidad:1.5,precio_unit:33.33}]),
  ]);
  assert.equal((await db.query("select total::text from cobros")).rows[0].total,"100.00");
  assert.equal(await contar(db,"select count(*)::int as n from cobro_pagos"),1);
});

test("farmacia y sesión sin usuario no crean cobros; núcleo no es RPC público", async () => {
  const db = await base();
  await db.exec("update usuarios set rol='farmacia'");
  await assert.rejects(cobrar(db),/No tienes permiso/);
  await db.exec("delete from usuarios");
  await assert.rejects(cobrar(db),/No se encontró/);
  assert.equal(await contar(db,"select count(*)::int as n from cobros"),0);
  const {rows} = await db.query("select has_function_privilege('authenticated','public._registrar_cobro_con_pagos(uuid,metodo_pago,text,jsonb,jsonb)','EXECUTE') as permitido");
  assert.equal(rows[0].permitido,false);
});

test("inventario FIFO y pagos se revierten juntos si falla tarjeta", async () => {
  const db = await base();
  const pid = '00000000-0000-0000-0000-000000000003';
  await db.exec(`insert into lotes values('00000000-0000-0000-0000-000000000004','${pid}',5,'2027-01-01',now());
    create function rechazar_tarjeta() returns trigger language plpgsql as $$ begin
      if new.metodo='tarjeta' then raise exception 'Fallo sintético'; end if; return new; end $$;
    create trigger fallo before insert on cobro_pagos for each row execute function rechazar_tarjeta();`);
  const conceptos = JSON.stringify([{tipo:"producto",producto_id:pid,cantidad:2,precio_unit:100}]);
  await assert.rejects(db.query("select registrar_cobro_mixto(null,'efectivo','',$1::jsonb,$2::jsonb)",[conceptos,pagos]),/Fallo sintético/);
  assert.equal((await db.query("select cantidad_actual::text from lotes")).rows[0].cantidad_actual,"5.00");
  assert.equal(await contar(db,"select count(*)::int as n from movimientos_inv"),0);
  await db.exec("drop trigger fallo on cobro_pagos");
  await db.query("select registrar_cobro_mixto(null,'efectivo','',$1::jsonb,$2::jsonb)",[conceptos,pagos]);
  assert.equal((await db.query("select cantidad_actual::text from lotes")).rows[0].cantidad_actual,"3.00");
});
