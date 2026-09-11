"""Lectura y normalización del Excel "Dra. Fedra v.5".

Solo lee y limpia. No decide nada del destino: de eso se encarga importar.py.
"""

import datetime as dt
import hashlib
import re
import unicodedata

RUTA = r"K:\TODOS LOS ARCHIVOS\FEDRA\Dra. Fedra v.5 (1).xlsx"
SHA_ESPERADO = "aa4058885d94fe3ac3d6a5a62596194f3efe8ebe065df3c65450f4e077261ec0"


def verificar_archivo(ruta=RUTA):
    h = hashlib.sha256()
    with open(ruta, "rb") as f:
        for b in iter(lambda: f.read(65536), b""):
            h.update(b)
    real = h.hexdigest()
    if real != SHA_ESPERADO:
        raise SystemExit(
            f"El Excel no es el autorizado.\n  esperado: {SHA_ESPERADO}\n  real:     {real}"
        )
    return real


def abrir(ruta=RUTA):
    import openpyxl

    return openpyxl.load_workbook(ruta, read_only=True, data_only=True)


def hoja(wb, nombre):
    """Filas de una hoja como diccionarios. Descarta renglones completamente vacíos."""
    ws = wb[nombre]
    it = ws.iter_rows(values_only=True)
    encabezado = [(str(h).strip() if h is not None else "") for h in next(it)]
    filas = []
    for r in it:
        if all(c is None or (isinstance(c, str) and not c.strip()) for c in r):
            continue
        filas.append(dict(zip(encabezado, r)))
    return filas


# --- normalización de valores ------------------------------------------------

def txt(v):
    """Texto limpio, o None si no hay nada."""
    if v is None:
        return None
    s = str(v).strip()
    if not s or s.lower() in ("none", "nan"):
        return None
    return s


def num(v):
    """Número a partir de '97 cm', '120.8', 83.5 o '1,940.00'. None si no hay."""
    if v is None or isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip().replace(",", "")
    m = re.search(r"-?\d+(?:\.\d+)?", s)
    return float(m.group()) if m else None


def ent(v):
    n = num(v)
    return int(n) if n is not None else None


def booleano(v):
    if isinstance(v, bool):
        return v
    s = txt(v)
    if s is None:
        return None
    return s.lower() in ("true", "si", "sí", "yes", "1", "x")


def fecha(v):
    """Fecha ISO (YYYY-MM-DD) o None."""
    if isinstance(v, dt.datetime):
        return v.date().isoformat()
    if isinstance(v, dt.date):
        return v.isoformat()
    s = txt(v)
    if not s:
        return None
    for patron in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y"):
        try:
            return dt.datetime.strptime(s[:10], patron).date().isoformat()
        except ValueError:
            continue
    return None


def marca(v, hora=None):
    """Timestamp ISO. Si llega una hora aparte, la combina con la fecha."""
    base = None
    if isinstance(v, dt.datetime):
        base = v
    elif isinstance(v, dt.date):
        base = dt.datetime.combine(v, dt.time())
    else:
        f = fecha(v)
        if f:
            base = dt.datetime.fromisoformat(f)
    if base is None:
        return None
    if hora is not None and isinstance(hora, dt.time):
        base = dt.datetime.combine(base.date(), hora)
    return base.isoformat()


def telefono(v):
    """Deja solo dígitos; descarta lo que claramente no es un teléfono."""
    s = txt(v)
    if not s:
        return None
    d = re.sub(r"\D", "", s)
    if len(d) < 10:
        return None
    return d[-10:] if len(d) <= 12 else d


def normaliza_etiqueta(s):
    """Para casar etiquetas del Excel con las de campos_historia."""
    s = txt(s) or ""
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"[^a-z0-9]+", " ", s.lower())
    return s.strip()
