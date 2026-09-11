"""Vacía las tablas operativas de producción. Paso destructivo.

Exige que exista un respaldo con manifiesto antes de tocar nada, y pide una
confirmación escrita. Lo que queda intacto está listado abajo y es explícito:
cuentas, roles, plantillas de historia clínica, bitácora de auditoría,
suscripciones de notificaciones y la conexión con Google Calendar.

Uso:
    python vaciar.py --respaldo <carpeta>            # muestra qué haría
    python vaciar.py --respaldo <carpeta> --ejecutar # vacía
"""

import hashlib
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import conexion as cx

# Orden: hijos antes que padres. TRUNCATE en un solo comando resuelve las
# dependencias entre ellas, pero el orden deja claro qué cuelga de qué.
OPERATIVAS = [
    "cobro_pagos", "cobro_items", "cobros",
    "venta_items", "pagos", "ventas",
    "receta_items", "recetas",
    "compra_items", "compras",
    "movimientos_inv",
    "producto_archivos", "lotes", "productos",
    "mensajes_wpp", "citas", "seguimientos",
    "fases", "tratamientos", "consultas",
    "historias_clinicas",
    "pacientes",
    "servicios", "proveedores", "categorias",
    "cortes_caja",
    "importacion_pendientes",
]

# Se quedan como están. Ninguna se toca en este script.
PRESERVADAS = [
    "usuarios", "tipos_historia", "campos_historia", "audit_log",
    "push_subscriptions", "google_calendar_conexion",
]


def respaldo_valido(carpeta):
    manifiesto = os.path.join(carpeta, "MANIFIESTO.txt")
    restaurar = os.path.join(carpeta, "restaurar.sql")
    if not os.path.isfile(manifiesto) or not os.path.isfile(restaurar):
        raise SystemExit(
            f"No hay respaldo utilizable en {carpeta}.\n"
            "Se esperan MANIFIESTO.txt y restaurar.sql. Corre respaldar.py primero."
        )
    contenido = open(manifiesto, encoding="utf-8").read()
    if f"Proyecto Supabase : {cx.PROYECTO}" not in contenido:
        raise SystemExit("El respaldo no corresponde al proyecto productivo autorizado.")
    esperados = re.findall(r"^  ([0-9a-f]{64})  (.+)$", contenido, re.MULTILINE)
    if not esperados:
        raise SystemExit("El manifiesto no contiene hashes verificables.")
    raiz = os.path.realpath(carpeta)
    for esperado, relativo in esperados:
        ruta = os.path.realpath(os.path.join(raiz, relativo))
        if os.path.commonpath([raiz, ruta]) != raiz or not os.path.isfile(ruta):
            raise SystemExit(f"Archivo de respaldo ausente o invalido: {relativo}")
        h = hashlib.sha256()
        with open(ruta, "rb") as f:
            for bloque in iter(lambda: f.read(65536), b""):
                h.update(bloque)
        if h.hexdigest() != esperado:
            raise SystemExit(f"El respaldo fue alterado: {relativo}")
    return manifiesto


def main():
    if "--respaldo" not in sys.argv:
        raise SystemExit("Falta --respaldo <carpeta>. No se vacía sin respaldo.")
    carpeta = sys.argv[sys.argv.index("--respaldo") + 1]
    manifiesto = respaldo_valido(carpeta)
    ejecuta = "--ejecutar" in sys.argv

    print(f"Respaldo verificado: {manifiesto}\n")

    faltan = []
    existentes = {
        f["tablename"]
        for f in cx.sql("select tablename from pg_tables where schemaname='public'")
    }
    print("SE VACÍAN")
    total = 0
    for t in OPERATIVAS:
        if t not in existentes:
            faltan.append(t)
            continue
        n = cx.sql(f"select count(*) as n from public.{t}")[0]["n"]
        total += n
        print(f"  {t:24s} {n:6d} filas")
    print(f"  {'TOTAL':24s} {total:6d} filas\n")

    print("SE CONSERVAN")
    for t in PRESERVADAS:
        if t not in existentes:
            continue
        n = cx.sql(f"select count(*) as n from public.{t}")[0]["n"]
        print(f"  {t:24s} {n:6d} filas")
    n_auth = cx.sql("select count(*) as n from auth.users")[0]["n"]
    print(f"  {'auth.users':24s} {n_auth:6d} cuentas  (no se toca)")

    if faltan:
        print(f"\nNo existen en la base (se ignoran): {', '.join(faltan)}")

    if not ejecuta:
        print("\nEnsayo. Nada se borró. Añade --ejecutar para vaciar.")
        return

    print(f"\nEsto borra {total} filas de producción y no se deshace solo.")
    respuesta = input('Escribe exactamente  BORRAR DATOS OPERATIVOS  para continuar: ')
    if respuesta.strip() != "BORRAR DATOS OPERATIVOS":
        raise SystemExit("Cancelado. No se borró nada.")

    lista = ", ".join(f"public.{t}" for t in OPERATIVAS if t in existentes)
    cx.sql(f"truncate {lista} restart identity;")
    print("\nTablas vacías. Conteo de comprobación:")
    for t in OPERATIVAS:
        if t not in existentes:
            continue
        n = cx.sql(f"select count(*) as n from public.{t}")[0]["n"]
        if n:
            print(f"  ¡{t} quedó con {n} filas!")
    print("  todas en 0")
    print(f"\nSe conservan las cuentas: {n_auth} en auth.users")


if __name__ == "__main__":
    main()
