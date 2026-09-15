// Levanta un Postgres real (PGlite, sin Docker) con la plantilla NOM-004 tal
// como queda después de las migraciones 13 y 18. Es la base sobre la que se
// prueban la migración 044 y las reglas de captura.
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const MIGRACIONES = path.join(RAIZ, "supabase/migrations");

export const leerMigracion = (nombre) =>
  fs.readFileSync(path.join(MIGRACIONES, nombre), "utf8");

// Solo las piezas de las que dependen las migraciones que se prueban. El
// esquema completo arrastra auth, storage y RLS, que no hacen al caso.
const ESQUEMA_BASE = `
create type rol_usuario as enum ('admin','farmacia','doctora','asistente','gerente');
create function current_rol() returns rol_usuario language sql stable as $$ select 'admin'::rol_usuario $$;

create table tipos_historia (
  id     uuid primary key default gen_random_uuid(),
  nombre text not null,
  activo boolean not null default true
);
create table campos_historia (
  id               uuid primary key default gen_random_uuid(),
  tipo_historia_id uuid not null references tipos_historia(id) on delete cascade,
  etiqueta         text not null,
  tipo_dato        text not null default 'texto',
  opciones         jsonb,
  orden            int not null default 0,
  requerido        boolean not null default false,
  seccion          text
);
`;

export async function baseConPlantilla() {
  const db = new PGlite();
  await db.exec(ESQUEMA_BASE);
  // La migración 13 crea la columna `seccion` que el esquema base ya trae.
  await db.exec(
    leerMigracion("20260529000013_hc_nom004.sql").replace(
      "alter table campos_historia add column if not exists seccion text;",
      "",
    ),
  );
  await db.exec(leerMigracion("20260529000018_heredofamiliares_multi.sql"));
  return db;
}

export const filas = async (db, sql) => (await db.query(sql)).rows;

export async function contar(db, sql) {
  const [{ n }] = await filas(db, sql);
  return Number(n);
}

// Retrato de la plantilla, para comparar antes y después de un intento fallido.
export async function retrato(db) {
  return JSON.stringify(
    await filas(
      db,
      `select id, etiqueta, tipo_dato, opciones, orden, requerido, seccion
         from campos_historia order by id`,
    ),
  );
}

export async function existeColumna(db, tabla, columna) {
  return (
    (await contar(
      db,
      `select count(*)::int as n from information_schema.columns
        where table_schema = 'public' and table_name = '${tabla}' and column_name = '${columna}'`,
    )) > 0
  );
}

// Los campos de la plantilla con la forma que el formulario recibe de Supabase.
export async function camposDeLaPlantilla(db) {
  return filas(
    db,
    `select c.id, c.etiqueta, c.tipo_dato, c.opciones, c.orden, c.requerido, c.seccion,
            c.oculto, c.depende_de, c.depende_valor, c.solo_sexo, c.valor_default, c.rol
       from campos_historia c
       join tipos_historia t on t.id = c.tipo_historia_id
      where t.nombre = 'Historia Clínica (NOM-004)'
      order by c.orden`,
  );
}
