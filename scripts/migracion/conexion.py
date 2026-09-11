"""Acceso a la base de producción para la migración del AppSheet v5.

Hablamos con la Management API de Supabase, que ejecuta SQL con un access token
de cuenta. Así no hace falta la contraseña de Postgres ni la service_role key
(que en Vercel está marcada como sensible y ya no se puede leer).

El token se lee de SUPABASE_ACCESS_TOKEN o del archivo que apunte
FEDRA_TOKEN_FILE. Nunca se imprime.
"""

import json
import os
import sys
import urllib.error
import urllib.request

PROYECTO = "kxtznwgdpvbtlsedmjap"  # producción — sistema-fedra.vercel.app
API = "https://api.supabase.com/v1"
LOTE_ORIGEN = "appsheet_v5_2026-09-10"


def token() -> str:
    t = os.environ.get("SUPABASE_ACCESS_TOKEN", "").strip()
    if not t:
        ruta = os.environ.get("FEDRA_TOKEN_FILE", r"C:\Users\Alex\fedra-access-token.txt")
        try:
            t = open(ruta, encoding="utf-8").read().strip()
        except OSError:
            pass
    if not t:
        sys.exit(
            "Falta el access token de Supabase.\n"
            "Ponlo en C:/Users/Alex/fedra-access-token.txt o en SUPABASE_ACCESS_TOKEN."
        )
    return t


def _pedir(metodo: str, ruta: str, cuerpo=None):
    datos = json.dumps(cuerpo).encode() if cuerpo is not None else None
    req = urllib.request.Request(
        f"{API}{ruta}",
        data=datos,
        method=metodo,
        headers={
            "Authorization": f"Bearer {token()}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            texto = r.read().decode()
            return json.loads(texto) if texto else None
    except urllib.error.HTTPError as e:
        detalle = e.read().decode()[:800]
        raise RuntimeError(f"{metodo} {ruta} -> {e.code}: {detalle}") from None


def sql(consulta: str):
    """Ejecuta SQL y devuelve las filas como lista de diccionarios."""
    return _pedir("POST", f"/projects/{PROYECTO}/database/query", {"query": consulta})


def proyecto():
    """Datos del proyecto. Sirve para confirmar que el token alcanza producción."""
    return _pedir("GET", f"/projects/{PROYECTO}")


def lit(v) -> str:
    """Literal SQL seguro para un valor de Python."""
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return repr(v)
    if isinstance(v, (dict, list)):
        return lit(json.dumps(v, ensure_ascii=False)) + "::jsonb"
    return "'" + str(v).replace("'", "''") + "'"
