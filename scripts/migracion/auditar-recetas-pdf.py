#!/usr/bin/env python3
"""Audita recetas PDF históricas sin escribir en Supabase.

Los PDFs de Fedra son formularios AcroForm: el nombre, la fecha, la fase y el
tratamiento viven en los valores canónicos de sus campos. El texto visible del
PDF puede estar vacío, por eso no se usa OCR ni el nombre del archivo como única
fuente. El resultado contiene datos clínicos y debe guardarse fuera del repo.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

from pypdf import PdfReader


FASE_RE = re.compile(r"^(FASE|RETOMAR|DESTETE|MANTENIMIENTO)\b", re.I)
FECHA_RE = re.compile(r"^(\d{1,2})/(\d{1,2})/(\d{2,4})$")
SUFIJO_ARCHIVO_RE = re.compile(
    r"\s+(?:F(?:ASE)?\s*[1-5]|RETOMAR|MANTENIMIENTO)(?:\s*[-_]?[A-Z]+)?$",
    re.I,
)


def texto(valor: Any) -> str:
    if valor is None:
        return ""
    return str(valor).replace("\r\n", "\n").replace("\r", "\n").strip()


def normalizar_nombre(valor: str) -> str:
    valor = unicodedata.normalize("NFKD", valor)
    valor = "".join(c for c in valor if not unicodedata.combining(c))
    valor = re.sub(r"[^A-Za-z0-9]+", " ", valor).upper()
    return " ".join(valor.split())


def nombre_desde_archivo(path: Path) -> str:
    nombre = re.sub(r"\s*\(\d+\)$", "", path.stem).strip()
    anterior = None
    while anterior != nombre:
        anterior = nombre
        nombre = SUFIJO_ARCHIVO_RE.sub("", nombre).strip(" -_")
    return nombre


def fecha_iso(valor: str) -> str | None:
    m = FECHA_RE.fullmatch(valor.strip())
    if not m:
        return None
    dia, mes, anio = map(int, m.groups())
    if anio < 100:
        anio += 2000
    try:
        return datetime(anio, mes, dia).date().isoformat()
    except ValueError:
        return None


def fase_numero(valor: str) -> int | None:
    m = re.search(r"\bFASE\s*([1-5])\b", valor, re.I)
    return int(m.group(1)) if m else None


def duracion_dias(valor: str) -> int | None:
    m = re.search(r"\((\d+)\s*d[íi]as?\)", valor, re.I)
    return int(m.group(1)) if m else None


def parsear_items(tratamiento: str) -> list[dict[str, Any]]:
    tratamiento = tratamiento.strip()
    if not tratamiento:
        return []

    if re.match(r"^Nota:?", tratamiento, re.I):
        items = []
        cuerpo = re.sub(r"^Nota:?", "", tratamiento, flags=re.I).strip()
        for bloque in re.split(r"(?m)^\s*-\s+", "\n" + cuerpo):
            bloque = bloque.strip()
            if not bloque:
                continue
            nombre, separador, dosis = bloque.partition(":")
            items.append(
                {
                    "medicamento": nombre.strip().rstrip("."),
                    "dosis": dosis.strip() if separador else "",
                    "duracion_dias": duracion_dias(bloque),
                    "indicaciones": "",
                }
            )
        return items

    items = []
    for bloque in re.split(r"(?m)^\s*\*\s*", "\n" + tratamiento):
        bloque = bloque.strip()
        if not bloque:
            continue
        lineas = [linea.strip() for linea in bloque.splitlines() if linea.strip()]
        if not lineas:
            continue
        nombre = lineas[0].rstrip(".")
        dosis = []
        indicaciones = []
        for linea in lineas[1:]:
            if linea.startswith("-"):
                indicaciones.append(linea.lstrip("- "))
            else:
                dosis.append(linea)
        items.append(
            {
                "medicamento": nombre,
                "dosis": "\n".join(dosis),
                "duracion_dias": duracion_dias(nombre),
                "indicaciones": "\n".join(indicaciones),
            }
        )
    return items


def leer_campos(path: Path) -> tuple[dict[str, str], str | None]:
    try:
        fields = PdfReader(str(path), strict=False).get_fields() or {}
    except Exception as exc:  # El archivo queda reportado, nunca se omite.
        return {}, f"{type(exc).__name__}: {exc}"
    return {
        nombre: texto(campo.get("/V"))
        for nombre, campo in fields.items()
        if texto(campo.get("/V"))
    }, None


def clasificar_campos(campos: dict[str, str]) -> dict[str, Any]:
    valores = list(campos.values())
    tratamientos = [v for v in valores if v.lstrip().startswith("*") or re.match(r"^Nota:?", v, re.I)]
    fases = [v for v in valores if FASE_RE.match(v.strip())]
    fechas = [f for v in valores if (f := fecha_iso(v))]
    otros = []
    for valor in valores:
        limpio = valor.strip()
        if valor in tratamientos or valor in fases or fecha_iso(valor):
            continue
        if re.fullmatch(r"\d{1,3}\s*(?:a|años?)?", limpio, re.I):
            continue
        if re.search(r"[A-Za-zÁÉÍÓÚÑáéíóúñ]", limpio) and "\n" not in limpio:
            otros.append(limpio)
    return {
        "tratamiento": max(tratamientos, key=len) if tratamientos else "",
        "fase_texto": max(fases, key=len) if fases else "",
        "fecha": fechas[0] if len(set(fechas)) == 1 else None,
        "fechas": sorted(set(fechas)),
        "nombres": otros,
    }


def cargar_pacientes(path: Path) -> tuple[list[dict[str, Any]], dict[str, list[dict[str, Any]]]]:
    pacientes = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(pacientes, list):
        raise ValueError("El JSON de pacientes debe contener una lista.")
    indice: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for paciente in pacientes:
        completo = " ".join(filter(None, [paciente.get("nombre"), paciente.get("apellidos")]))
        indice[normalizar_nombre(completo)].append(paciente)
    return pacientes, indice


def sugerencias(nombre: str, claves: list[str]) -> list[dict[str, Any]]:
    objetivo = normalizar_nombre(nombre)
    mejores = sorted(
        ((SequenceMatcher(None, objetivo, clave).ratio(), clave) for clave in claves),
        reverse=True,
    )[:3]
    return [{"nombre_normalizado": clave, "similitud": round(puntaje, 3)} for puntaje, clave in mejores if puntaje >= 0.72]


def auditar(source: Path, patients_path: Path, incluir_sugerencias: bool = True, por_nombre: bool = False) -> dict[str, Any]:
    pacientes, indice = cargar_pacientes(patients_path)
    archivos = sorted(source.rglob("*.pdf"))
    registros = []
    estados = Counter()
    canonicos: dict[str, str] = {}

    for path in archivos:
        campos, error = leer_campos(path)
        rel = path.relative_to(source).as_posix()
        huella = hashlib.sha256(path.read_bytes()).hexdigest()
        base = {
            "archivo_relativo": rel,
            "sha256": huella,
            "id_legacy": f"receta_pdf:{huella}",
        }
        if huella in canonicos:
            registros.append({**base, "estado": "duplicado", "archivo_canonico": canonicos[huella]})
            estados["duplicado"] += 1
            continue
        canonicos[huella] = rel
        if error:
            registros.append({**base, "estado": "pdf_invalido", "error": error})
            estados["pdf_invalido"] += 1
            continue

        partes = clasificar_campos(campos)
        nombre_archivo = nombre_desde_archivo(path)
        candidatos_nombre = partes["nombres"]
        nombre_interno = candidatos_nombre[0] if len(candidatos_nombre) == 1 else ""
        fuentes = [n for n in [nombre_interno, nombre_archivo] if n]
        coincidencias = {}
        for fuente in fuentes:
            ids = [p["id"] for p in indice.get(normalizar_nombre(fuente), [])]
            if ids:
                coincidencias[fuente] = ids

        ids_unicos = sorted({pid for ids in coincidencias.values() for pid in ids})
        paciente_id = ids_unicos[0] if len(ids_unicos) == 1 else None
        items = parsear_items(partes["tratamiento"])
        nombres_normalizados = {normalizar_nombre(n) for n in fuentes}
        if len(candidatos_nombre) > 1:
            estado = "nombre_interno_ambiguo"
            paciente_id = None
        elif len(nombres_normalizados) > 1:
            estado = "conflicto_nombre"
            paciente_id = None
        elif len(ids_unicos) > 1:
            estado = "conflicto_paciente"
            paciente_id = None
        elif por_nombre and len(ids_unicos) == 1:
            # Vincular el PDF no requiere inventar fecha ni medicamentos.
            estado = "listo" if items and partes["fecha"] else "listo_documento"
        elif not items:
            estado = "sin_tratamiento"
        elif not partes["fecha"]:
            estado = "sin_fecha"
        elif len(ids_unicos) == 1:
            estado = "listo"
        else:
            estado = "sin_paciente"
            paciente_id = None

        nombre_busqueda = nombre_interno or nombre_archivo
        registros.append(
            {
                **base,
                "estado": estado,
                "paciente_id": paciente_id,
                "nombre_interno": nombre_interno or None,
                "nombres_internos_detectados": candidatos_nombre,
                "nombre_archivo": nombre_archivo,
                "fecha": partes["fecha"],
                "fechas_detectadas": partes["fechas"],
                "fase": fase_numero(partes["fase_texto"]),
                "fase_texto": partes["fase_texto"] or None,
                "items": items,
                "sugerencias": [] if estado == "listo" or not incluir_sugerencias else sugerencias(nombre_busqueda, list(indice)),
            }
        )
        estados[estado] += 1

    if not por_nombre:
        marcar_coincidencias_fecha(registros)
    estados = Counter(r["estado"] for r in registros)
    return {
        "generado_en": datetime.now().astimezone().isoformat(),
        "origen": str(source.resolve()),
        "pacientes_fuente": str(patients_path.resolve()),
        "pacientes_sha256": hashlib.sha256(patients_path.read_bytes()).hexdigest(),
        "pacientes_archivo_modificado_en": datetime.fromtimestamp(patients_path.stat().st_mtime).astimezone().isoformat(),
        "incluye_sugerencias_aproximadas": incluir_sugerencias,
        "criterio_vinculacion": "nombre_unico" if por_nombre else "estructurado_estricto",
        "resumen": {
            "pdfs": len(archivos),
            "pacientes_disponibles": len(pacientes),
            "estados": dict(sorted(estados.items())),
            "items_listos": sum(len(r.get("items", [])) for r in registros if r.get("estado") == "listo"),
            "documentos_vinculables": sum(r.get("estado") in ("listo", "listo_documento") for r in registros),
        },
        "recetas": registros,
    }


def marcar_coincidencias_fecha(registros: list[dict[str, Any]]) -> None:
    """Dos recetas del mismo día pueden ser legítimas. No decidir sin cotejo."""
    grupos = defaultdict(list)
    for registro in registros:
        if registro.get("estado") == "listo":
            grupos[(registro["paciente_id"], registro["fecha"])].append(registro)
    for grupo in grupos.values():
        if len(grupo) < 2:
            continue
        identicos = len({json.dumps({k: r.get(k) for k in ("fase", "fase_texto", "items")},
            sort_keys=True, ensure_ascii=False) for r in grupo}) == 1
        for registro in grupo:
            registro["estado"] = "revisar_misma_fecha"
            registro["coincidencias_misma_fecha"] = [r["id_legacy"] for r in grupo if r is not registro]
            registro["tratamiento_identico_en_grupo"] = identicos


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--patients", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--sin-sugerencias", action="store_true", help="Solo cotejo exacto; omitir similitudes orientativas.")
    parser.add_argument("--por-nombre", action="store_true", help="Vincular documentos por nombre único, sin exigir fecha, tratamiento ni distinta fecha.")
    args = parser.parse_args()

    if not args.source.is_dir():
        parser.error(f"No existe la carpeta fuente: {args.source}")
    if not args.patients.is_file():
        parser.error(f"No existe el JSON de pacientes: {args.patients}")
    if args.output.resolve().is_relative_to(args.source.resolve()):
        parser.error("La salida no puede escribirse dentro de la carpeta clínica original.")
    raices = [Path(__file__).resolve().parents[2]]
    for carpeta in [Path.cwd(), args.output.resolve().parent]:
        consulta = subprocess.run(["git", "-C", str(carpeta), "rev-parse", "--show-toplevel"], capture_output=True, text=True)
        if consulta.returncode == 0:
            raices.append(Path(consulta.stdout.strip()).resolve())
    if any(args.output.resolve().is_relative_to(raiz) for raiz in raices):
        parser.error("El manifiesto clínico debe guardarse fuera de cualquier repositorio Git.")

    resultado = auditar(args.source, args.patients, incluir_sugerencias=not args.sin_sugerencias, por_nombre=args.por_nombre)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(resultado, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(resultado["resumen"], ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
