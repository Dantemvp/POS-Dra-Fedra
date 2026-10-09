import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { leerMigracion } from "./fixtures/nom004.mjs";
const pid = "00000000-0000-0000-0000-000000000001";
const sha = "a".repeat(64);
const ruta = `receta/${pid}/${sha}.pdf`;
async function base() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema storage; grant usage on schema public,storage to authenticated;
    create function public.current_rol() returns text language sql stable as $$ select current_setting('prueba.rol',true) $$;
    create table pacientes(id uuid primary key); insert into pacientes values('${pid}');
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(bucket_id text,name text);
    alter table storage.objects enable row level security;
    grant select,insert,update,delete on storage.objects to authenticated;`);
  await db.exec(leerMigracion("20261009012941_archivos_historicos_paciente.sql"));
  return db;
}
test("original sin fecha se admite; mismo día no es una restricción", async () => {
  const db = await base();
  await db.exec(`insert into archivos_paciente_historicos(paciente_id,tipo,sha256,storage_path,nombre_archivo,origen_datos)
    values('${pid}','receta','${sha}','${ruta}','SINTETICA.pdf','PRUEBA');`);
  assert.equal((await db.query("select fecha_documento from archivos_paciente_historicos")).rows[0].fecha_documento,null);
  await assert.rejects(db.exec(`insert into archivos_paciente_historicos(paciente_id,tipo,sha256,storage_path,nombre_archivo,origen_datos)
    values('${pid}','receta','${sha}','receta/otra-paciente/${sha}.pdf','SINTETICA.pdf','PRUEBA');`));
});
test("roles clínicos leen; farmacia y objeto huérfano no son visibles", async () => {
  const db = await base();
  await db.exec(`insert into archivos_paciente_historicos(paciente_id,tipo,sha256,storage_path,nombre_archivo,origen_datos)
    values('${pid}','receta','${sha}','${ruta}','SINTETICA.pdf','PRUEBA');
    insert into storage.objects values('historicos-clinicos','${ruta}'),('historicos-clinicos','huerfano.pdf');
    set role authenticated;`);
  for (const rol of ["admin","doctora","gerente","asistente","farmacia"]) {
    await db.exec(`set prueba.rol='${rol}'`);
    assert.equal((await db.query("select * from archivos_paciente_historicos")).rows.length,rol === "farmacia" ? 0 : 1);
    assert.equal((await db.query("select * from storage.objects")).rows.length,rol === "farmacia" ? 0 : 1);
  }
});
test("sesión clínica no puede alterar metadatos ni bytes", async () => {
  const db = await base();
  await db.exec(`insert into storage.objects values('historicos-clinicos','${ruta}');
    set role authenticated; set prueba.rol='admin';`);
  await assert.rejects(db.exec("delete from archivos_paciente_historicos"),/permission denied/);
  await assert.rejects(db.exec(`insert into storage.objects values('historicos-clinicos','nuevo.pdf')`),/row-level security/);
  assert.equal((await db.query("delete from storage.objects returning *")).rows.length,0);
  assert.equal((await db.query("update storage.objects set name='modificado.pdf' returning *")).rows.length,0);
  await db.exec("reset role");
  assert.equal((await db.query("select name from storage.objects")).rows[0].name,ruta);
});
