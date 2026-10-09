#!/usr/bin/env python3
"""Extrae tratamiento y fase de los campos AcroForm de las plantillas PDF.

No copia nombre, edad ni fecha del paciente. La salida intermedia conserva el
formato que consume plantillas-parsear.mjs y puede revisarse antes de generar SQL.
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path

from pypdf import PdfReader


FASE_RE = re.compile(r"^(FASE|RETOMAR|DESTETE|MANTENIMIENTO)\b", re.I)


def valor(campo: object) -> str:
    if not isinstance(campo, dict):
        return ""
    raw = campo.get("/V")
    return str(raw).replace("\r\n", "\n").replace("\r", "\n").strip() if raw is not None else ""


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()

    args.output.mkdir(parents=True, exist_ok=True)
    pdfs = sorted(args.source.rglob("*.pdf"))
    errores = []
    vacias = []

    for pdf in pdfs:
        try:
            fields = PdfReader(str(pdf), strict=False).get_fields() or {}
        except Exception as exc:
            errores.append(f"{pdf}: {type(exc).__name__}: {exc}")
            continue
        valores = [valor(campo) for campo in fields.values()]
        tratamiento = next((v for v in valores if v.lstrip().startswith("*") or re.match(r"^Nota:?", v, re.I)), "")
        fase = next((v for v in valores if FASE_RE.match(v.strip())), "")
        # Algunos formularios alinean el nombre con varios espacios después de
        # la viñeta. El parser usa huecos grandes para separar columnas, así que
        # aquí normalizamos solo ese margen y no el contenido de la dosis.
        tratamiento = re.sub(r"(?m)^(\s*\*)\s+", r"\1 ", tratamiento)
        if not tratamiento:
            vacias.append(str(pdf.relative_to(args.source)))

        categoria = pdf.parent.name
        destino = args.output / f"{categoria}~{pdf.stem}.txt"
        contenido = "NOMBRE:\n"
        if tratamiento:
            contenido += tratamiento + "\n"
        if fase:
            contenido += " " * 60 + fase + "\n"
        destino.write_text(contenido, encoding="utf-8")

    print(f"PDFs: {len(pdfs)}")
    print(f"Sin tratamiento: {len(vacias)}")
    for item in vacias:
        print(f"  VACIA {item}")
    print(f"Errores: {len(errores)}")
    for item in errores:
        print(f"  ERROR {item}")
    return 1 if errores else 0


if __name__ == "__main__":
    raise SystemExit(main())
