"""Respaldo completo del esquema public antes de reemplazar los datos operativos.

Produce, en una carpeta con fecha y hora:
  datos/<tabla>.json    una tabla por archivo, tal cual está hoy
  restaurar.sql         INSERTs para devolver la base a este punto
  estructura.json       columnas, políticas RLS, funciones y triggers
  auth_users.json       id/email de las cuentas (sin contraseñas)
  MANIFIESTO.txt        conteo por tabla y SHA-256 de cada archivo

No borra nada. Se corre antes del vaciado y se vuelve a correr cuando haga falta.
"""

import datetime as dt
import hashlib
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import conexion as cx

RAIZ = r"C:\Users\Alex\ConsultoraDV\respaldos-fedra"


def tablas_publicas():
    filas = cx.sql(
        "select tablename from pg_tables where schemaname='public' order by tablename"
    )
    return [f["tablename"] for f in filas]


def volcar(tabla):
    return cx.sql(f'select * from public."{tabla}"')


def sql_insert(tabla, filas):
    """INSERTs restaurables para una tabla."""
    if not filas:
        return f'-- {tabla}: vacía\n'
    cols = list(filas[0].keys())
    lineas = [f'-- {tabla}: {len(filas)} filas']
    listado = ", ".join(f'"{c}"' for c in cols)
    for f in filas:
        vals = ", ".join(cx.lit(f.get(c)) for c in cols)
        lineas.append(f'insert into public."{tabla}" ({listado}) values ({vals});')
    return "\n".join(lineas) + "\n"


def estructura():
    return {
        "columnas": cx.sql(
            "select table_name, column_name, data_type, is_nullable, column_default "
            "from information_schema.columns where table_schema='public' "
            "order by table_name, ordinal_position"
        ),
        "politicas": cx.sql(
            "select schemaname, tablename, policyname, cmd, qual, with_check "
            "from pg_policies where schemaname='public' order by tablename, policyname"
        ),
        "funciones": cx.sql(
            "select p.proname, pg_get_function_identity_arguments(p.oid) as args "
            "from pg_proc p join pg_namespace n on n.oid=p.pronamespace "
            "where n.nspname='public' order by p.proname"
        ),
        "triggers": cx.sql(
            "select event_object_table, trigger_name, event_manipulation "
            "from information_schema.triggers where trigger_schema='public' "
            "order by event_object_table, trigger_name"
        ),
        "migraciones_aplicadas": cx.sql(
            "select version from supabase_migrations.schema_migrations order by version"
        ),
    }


def sha(ruta):
    h = hashlib.sha256()
    with open(ruta, "rb") as f:
        for bloque in iter(lambda: f.read(65536), b""):
            h.update(bloque)
    return h.hexdigest()


def main():
    sello = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    destino = os.path.join(RAIZ, f"prod-{sello}")
    os.makedirs(os.path.join(destino, "datos"), exist_ok=True)
    print(f"Respaldo en: {destino}\n")

    tablas = tablas_publicas()
    conteos, partes = {}, []
    for t in tablas:
        filas = volcar(t)
        conteos[t] = len(filas)
        with open(os.path.join(destino, "datos", f"{t}.json"), "w", encoding="utf-8") as f:
            json.dump(filas, f, ensure_ascii=False, indent=1, default=str)
        partes.append(sql_insert(t, filas))
        print(f"  {t:34s} {len(filas):6d} filas")

    with open(os.path.join(destino, "restaurar.sql"), "w", encoding="utf-8") as f:
        f.write(
            "-- Restauración del esquema public al estado previo a la importación\n"
            f"-- Generado: {dt.datetime.now().isoformat(timespec='seconds')}\n"
            "-- Uso: vaciar las tablas operativas y correr este archivo completo.\n"
            "--      Las migraciones deben estar aplicadas antes (estructura igual).\n\n"
            "begin;\nset session_replication_role = replica;  -- no disparar triggers ni FKs\n\n"
        )
        f.write("\n".join(partes))
        f.write("\nset session_replication_role = origin;\ncommit;\n")

    with open(os.path.join(destino, "estructura.json"), "w", encoding="utf-8") as f:
        json.dump(estructura(), f, ensure_ascii=False, indent=1, default=str)

    usuarios_auth = cx.sql(
        "select id, email, created_at, last_sign_in_at from auth.users order by created_at"
    )
    with open(os.path.join(destino, "auth_users.json"), "w", encoding="utf-8") as f:
        json.dump(usuarios_auth, f, ensure_ascii=False, indent=1, default=str)

    lineas = [
        "RESPALDO DE PRODUCCIÓN — POS Dra. Fedra",
        f"Proyecto Supabase : {cx.PROYECTO}",
        f"Fecha             : {dt.datetime.now().isoformat(timespec='seconds')}",
        f"Tablas            : {len(tablas)}",
        f"Filas totales     : {sum(conteos.values())}",
        f"Cuentas en auth   : {len(usuarios_auth)}",
        "",
        "CONTEO POR TABLA",
    ]
    for t in tablas:
        lineas.append(f"  {t:34s} {conteos[t]:6d}")
    lineas += ["", "SHA-256 POR ARCHIVO"]
    for carpeta, _, archivos in os.walk(destino):
        for a in sorted(archivos):
            if a == "MANIFIESTO.txt":
                continue
            ruta = os.path.join(carpeta, a)
            rel = os.path.relpath(ruta, destino)
            lineas.append(f"  {sha(ruta)}  {rel}")
    lineas += [
        "",
        "CÓMO RESTAURAR",
        "  1. Confirmar que las migraciones aplicadas coinciden con estructura.json.",
        "  2. Vaciar las tablas operativas (mismo orden que usa vaciar.py).",
        "  3. Correr restaurar.sql completo contra la base.",
        "  4. Cotejar los conteos de arriba con select count(*) por tabla.",
        "  auth.users no se toca en ningún paso: se respalda solo para cotejar.",
    ]
    manifiesto = os.path.join(destino, "MANIFIESTO.txt")
    with open(manifiesto, "w", encoding="utf-8") as f:
        f.write("\n".join(lineas) + "\n")

    print(f"\nFilas totales: {sum(conteos.values())}")
    print(f"Manifiesto:    {manifiesto}")
    return destino


if __name__ == "__main__":
    main()
