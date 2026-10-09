import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { leerMigracion, contar } from "./fixtures/nom004.mjs";

async function base() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated;
    create type metodo_pago as enum ('efectivo','tarjeta','transferencia','otro');
    create table cobros(id uuid primary key, total numeric);
    create table cobro_pagos(cobro_id uuid references cobros(id), metodo metodo_pago, monto numeric);
    create function public.registrar_cobro(p_paciente uuid,p_metodo metodo_pago,p_nota text,p_items jsonb)
    returns uuid language plpgsql as $$ declare v_id uuid := gen_random_uuid(); v_total numeric; begin
      select sum((i->>'cantidad')::numeric*(i->>'precio_unit')::numeric) into v_total from jsonb_array_elements(p_items) i;
      insert into cobros values(v_id,v_total);
      insert into cobro_pagos values(v_id,p_metodo,v_total);
      return v_id;
    end $$;`);
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
