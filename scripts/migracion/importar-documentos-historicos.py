"""Sube PDFs originales por nombre único. No emite ni reescribe recetas.

Credencial: sesión de Supabase CLI de la cuenta dueña de producción.
Nunca imprime ni guarda la clave de servicio obtenida del CLI.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import urllib.request
import urllib.error
import unicodedata

PROYECTO = "kxtznwgdpvbtlsedmjap"
BUCKET = "historicos-clinicos"

def normalizar(valor):
    return " ".join(re.sub(r"[^a-z0-9 ]", " ", unicodedata.normalize("NFKD",valor.lower()).encode("ascii","ignore").decode()).split())

def plan(manifiesto):
    if manifiesto.get("criterio_vinculacion") != "nombre_unico":
        raise ValueError("Usa el manifiesto autorizado --por-nombre, no uno anterior.")
    return [r for r in manifiesto["recetas"] if r["estado"] in ("listo","listo_documento")]

def verificar_identidades(registros,previos,indice):
    for r in registros:
        p = previos[r["paciente_id"]]
        nombre = normalizar(p["nombre"]+" "+(p.get("apellidos") or ""))
        fuentes = [normalizar(r[k]) for k in ("nombre_interno","nombre_archivo") if r.get(k)]
        if not fuentes or any(f != nombre for f in fuentes) or indice.get(nombre) != [r["paciente_id"]]:
            raise ValueError("La identidad del documento no coincide con un paciente único vigente.")

class Cliente:
    def __init__(self):
        comando = ["npx.cmd" if os.name == "nt" else "npx", "--yes", "supabase", "projects", "api-keys",
            "--project-ref",PROYECTO,"--output","json","--agent","no"]
        resultado = subprocess.run(comando,capture_output=True,text=True,check=False)
        if resultado.returncode:
            raise RuntimeError("El CLI no pudo obtener acceso a producción. Inicia sesión con la cuenta dueña.")
        claves = json.loads(resultado.stdout)
        self.clave = next(k["api_key"] for k in claves if k.get("name") == "service_role")
    def pedir(self,ruta,metodo="GET",datos=None,pdf=False):
        headers = {"Authorization":f"Bearer {self.clave}","apikey":self.clave,
            "Content-Type":"application/pdf" if pdf else "application/json"}
        if metodo == "POST" and not pdf:
            headers["Prefer"] = "resolution=ignore-duplicates,return=representation"
        req = urllib.request.Request(f"https://{PROYECTO}.supabase.co/{ruta}",method=metodo,
            data=datos if pdf else json.dumps(datos).encode() if datos is not None else None,headers=headers)
        with urllib.request.urlopen(req,timeout=120) as respuesta:
            cuerpo = respuesta.read()
            return cuerpo if pdf else json.loads(cuerpo) if cuerpo else None

def importar(manifiesto,reporte,aplicar=False):
    registros = plan(manifiesto)
    tipo = manifiesto.get("tipo_documento", "receta")
    if tipo not in ("receta", "inbody"):
        raise ValueError("Tipo de documento histórico no permitido.")
    fuente = Path(manifiesto["origen"]).resolve()
    padron = Path(manifiesto["pacientes_fuente"])
    if hashlib.sha256(padron.read_bytes()).hexdigest() != manifiesto["pacientes_sha256"]:
        raise ValueError("El padrón local cambió después del cotejo.")
    for r in registros:
        archivo = (fuente/r["archivo_relativo"]).resolve()
        if not archivo.is_relative_to(fuente) or hashlib.sha256(archivo.read_bytes()).hexdigest() != r["sha256"]:
            raise ValueError("Un PDF cambió o salió de la carpeta autorizada. Repite el cotejo.")
    resumen = {"seleccionados":len(registros),"nuevos":0,"ya_existentes":0,"fallidos":0,"aplicado":aplicar}
    if not aplicar:
        print(json.dumps(resumen))
        return
    cliente = Cliente()
    # Validar nuevamente nombres e identidad contra el padrón efectivo.
    actuales = []
    for offset in range(0,100000,1000):
        pagina = cliente.pedir(f"rest/v1/pacientes?select=id,nombre,apellidos&order=id&offset={offset}&limit=1000")
        actuales.extend(pagina)
        if len(pagina) < 1000: break
    indice = {}
    for p in actuales:
        indice.setdefault(normalizar(p["nombre"]+" "+(p["apellidos"] or "")),[]).append(p["id"])
    previos = {p["id"]:p for p in json.loads(padron.read_text(encoding="utf-8-sig"))}
    verificar_identidades(registros,previos,indice)
    # Comprobar tabla y bucket privado antes de subir el primer byte.
    cliente.pedir("rest/v1/archivos_paciente_historicos?select=id&limit=1")
    bucket = cliente.pedir(f"storage/v1/bucket/{BUCKET}")
    if bucket.get("public") is not False: raise ValueError("El bucket debe ser privado.")
    respaldo = reporte.with_suffix(".respaldo.json")
    if respaldo.exists(): raise ValueError("Ya existe el respaldo de esa corrida; usa otro reporte.")
    anteriores = []
    for offset in range(0,100000,1000):
        pagina = cliente.pedir(f"rest/v1/archivos_paciente_historicos?select=*&order=id&offset={offset}&limit=1000")
        anteriores.extend(pagina)
        if len(pagina) < 1000: break
    respaldo.write_text(json.dumps({"proyecto":PROYECTO,"documentos_anteriores":anteriores},indent=2),encoding="utf-8")
    resultados = []
    for r in registros:
        ruta = f"{tipo}/{r['paciente_id']}/{r['sha256']}.pdf"
        contenido = (fuente/r["archivo_relativo"]).read_bytes()
        try:
            if hashlib.sha256(contenido).hexdigest() != r["sha256"]:
                raise ValueError("El PDF cambió después del preflight.")
            try:
                cliente.pedir(f"storage/v1/object/{BUCKET}/{ruta}","POST",contenido,pdf=True)
            except urllib.error.HTTPError as error:
                if error.code not in (400,409): raise
                existente = cliente.pedir(f"storage/v1/object/{BUCKET}/{ruta}",pdf=True)
                if hashlib.sha256(existente).hexdigest() != r["sha256"]:
                    raise ValueError("El objeto existente tiene una huella distinta.") from None
            fila = {"paciente_id":r["paciente_id"],"tipo":tipo,"sha256":r["sha256"],
                "storage_path":ruta,"nombre_archivo":Path(r["archivo_relativo"]).name,
                "fecha_documento":r.get("fecha"),"origen_datos":manifiesto.get("origen_datos", "recetas_pdf_20261008")}
            guardado = cliente.pedir("rest/v1/archivos_paciente_historicos?on_conflict=paciente_id,tipo,sha256","POST",fila)
            resumen["nuevos" if guardado else "ya_existentes"] += 1
            resultados.append({"sha256":r["sha256"],"paciente_id":r["paciente_id"],"storage_path":ruta,
                "estado":"ok","nuevo":bool(guardado),"id":guardado[0]["id"] if guardado else None})
        except Exception as error:
            resumen["fallidos"] += 1
            # No incluir respuestas del proveedor, nombres ni credenciales.
            resultados.append({"sha256":r["sha256"],"estado":"fallo","tipo_error":type(error).__name__})
        reporte.write_text(json.dumps({"resumen":resumen,"resultados":resultados},indent=2),encoding="utf-8")
        if len(resultados) % 25 == 0:
            print(json.dumps({"procesados":len(resultados),"total":len(registros),
                "nuevos":resumen["nuevos"],"ya_existentes":resumen["ya_existentes"],"fallidos":resumen["fallidos"]}),flush=True)
    print(json.dumps(resumen))
    if resumen["fallidos"]: raise SystemExit(2)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest",required=True,type=Path)
    parser.add_argument("--report",required=True,type=Path)
    parser.add_argument("--apply",action="store_true")
    args = parser.parse_args()
    destino = args.report.resolve()
    manifest = args.manifest.resolve()
    consulta = subprocess.run(["git","-C",str(destino.parent),"rev-parse","--show-toplevel"],capture_output=True,text=True)
    raiz = Path(__file__).resolve().parents[2]
    if destino == manifest or destino.is_relative_to(raiz) or (consulta.returncode == 0 and destino.is_relative_to(Path(consulta.stdout.strip()).resolve())):
        parser.error("El reporte debe quedar fuera de Git y no sobrescribir el manifiesto.")
    if destino.exists(): parser.error("Usa un reporte nuevo; no sobrescribas el registro de otra corrida.")
    if not destino.parent.is_dir(): parser.error("La carpeta privada del reporte no existe.")
    importar(json.loads(manifest.read_text(encoding="utf-8")),destino,args.apply)

if __name__ == "__main__": main()
