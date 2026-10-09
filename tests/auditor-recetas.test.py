import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("auditor", Path(__file__).resolve().parents[1] / "scripts/migracion/auditar-recetas-pdf.py")
auditor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(auditor)

class Cotejo(unittest.TestCase):
    def ejecutar(self, campos, nombre="ANA PRUEBA UNO", duplicar=False):
        with tempfile.TemporaryDirectory() as carpeta:
            raiz = Path(carpeta)
            fuente = raiz / "pdfs"
            fuente.mkdir()
            (fuente / (nombre + ".pdf")).write_bytes(b"PDF SINTETICO")
            if duplicar:
                (fuente / (nombre + " (1).pdf")).write_bytes(b"PDF SINTETICO")
            pacientes = raiz / "pacientes.json"
            pacientes.write_text(json.dumps([{"id":"p1","nombre":"ANA PRUEBA UNO","apellidos":""}]), encoding="utf-8")
            with patch.object(auditor, "leer_campos", return_value=(campos,None)):
                return auditor.auditar(fuente,pacientes)

    def test_sin_fecha_ni_tratamiento_no_esta_lista(self):
        self.assertNotEqual(self.ejecutar({"nombre":"ANA PRUEBA UNO"})["recetas"][0]["estado"], "listo")

    def test_nombre_archivo_no_gana_al_interno(self):
        resultado = self.ejecutar({"nombre":"OTRA PERSONA SINTETICA","fecha":"1/2/2025","tratamiento":"* Medicamento ficticio\nDosis ficticia"})
        self.assertEqual(resultado["recetas"][0]["estado"],"conflicto_nombre")

    def test_varios_nombres_internos_quedan_pendientes(self):
        resultado = self.ejecutar({"nombre":"ANA PRUEBA UNO","otro":"OTRA PERSONA SINTETICA","fecha":"1/2/2025","tratamiento":"* Medicamento ficticio"})
        self.assertEqual(resultado["recetas"][0]["estado"],"nombre_interno_ambiguo")

    def test_coincidencia_completa_esta_lista_y_tiene_huella_padron(self):
        resultado = self.ejecutar({"nombre":"ANA PRUEBA UNO","fecha":"1/2/2025","tratamiento":"* Medicamento ficticio"})
        self.assertEqual(resultado["recetas"][0]["estado"],"listo")
        self.assertEqual(len(resultado["pacientes_sha256"]),64)

    def test_duplicado_no_crea_segunda_receta_lista(self):
        resultado = self.ejecutar({"nombre":"ANA PRUEBA UNO","fecha":"1/2/2025","tratamiento":"* Medicamento ficticio"},duplicar=True)
        self.assertEqual(resultado["resumen"]["estados"],{"duplicado":1,"listo":1})

if __name__ == "__main__":
    unittest.main()
