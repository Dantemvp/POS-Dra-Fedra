import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { leerMigracion } from './fixtures/nom004.mjs';

const paciente = '00000000-0000-0000-0000-000000000001';
const archivo = `pacientes/${paciente}/frente-00000000-0000-0000-0000-000000000002.jpg`;
const sql = leerMigracion('20261113000049_identificaciones_pacientes.sql');
async function base(t) {
  const db = new PGlite(); t.after(() => db.close());
  await db.exec(`create role anon; create role authenticated;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text);
    create table pacientes(id uuid primary key);
    insert into pacientes values ('${paciente}');
    create function public.current_rol() returns text language sql stable as $$ select current_setting('request.jwt.claim.rol',true) $$;
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated, anon;
    grant select,insert,update,delete on storage.objects to authenticated;
    grant select on storage.objects to anon;
    grant select on pacientes to authenticated;
  `);
  return db;
}
async function como(db,rol) {
  await db.exec(`reset role; select set_config('request.jwt.claim.rol','${rol}',false); set role authenticated;`);
}

test('049 admite carga y consulta clínica, bloquea farmacia, anónimo, rutas ajenas, reemplazo y borrado', async t => {
  const db = await base(t); await db.exec(sql); await db.exec(sql);
  const bucket = (await db.query('select * from storage.buckets')).rows[0];
  assert.equal(bucket.public,false); assert.equal(Number(bucket.file_size_limit),4194304);
  for (const rol of ['admin','doctora','asistente','gerente']) {
    await como(db,rol);
    await db.query('insert into storage.objects(bucket_id,name) values ($1,$2)', ['identificaciones-pacientes',archivo]);
    assert.ok((await db.query('select * from storage.objects')).rows.length > 0);
  }
  await db.exec('delete from storage.objects');
  assert.equal((await db.query('select count(*)::int n from storage.objects')).rows[0].n,4,'sin permiso de borrado');
  await assert.rejects(db.query('insert into storage.objects(bucket_id,name) values ($1,$2)', ['identificaciones-pacientes',archivo.replace(paciente,'00000000-0000-0000-0000-000000000099')]),/row-level security/);
  await assert.rejects(db.query('insert into storage.objects(bucket_id,name) values ($1,$2)', ['identificaciones-pacientes','../otro.pdf']),/row-level security/);
  await como(db,'farmacia');
  assert.equal((await db.query('select * from storage.objects')).rows.length,0);
  await assert.rejects(db.query('insert into storage.objects(bucket_id,name) values ($1,$2)', ['identificaciones-pacientes',archivo]),/row-level security/);
  await db.exec('reset role; set role anon;');
  assert.equal((await db.query('select * from storage.objects')).rows.length,0);
});

test('049 aborta ante un bucket preexistente público sin modificar su configuración', async t => {
  const db = await base(t);
  await db.exec("insert into storage.buckets values ('identificaciones-pacientes','identificaciones-pacientes',true,4194304,array['image/jpeg'])");
  await assert.rejects(db.exec(sql),/otra configuración/);
  await db.exec('rollback');
  assert.equal((await db.query('select public from storage.buckets')).rows[0].public,true);
  assert.equal((await db.query("select * from pg_policies where tablename='objects'")).rows.length,0);
});
