import importlib.util
from pathlib import Path
import unittest
spec = importlib.util.spec_from_file_location("importador",Path(__file__).resolve().parents[1]/"scripts/migracion/importar-documentos-historicos.py")
modulo = importlib.util.module_from_spec(spec)
spec.loader.exec_module(modulo)

class Importador(unittest.TestCase):
    def test_incluye_original_sin_fecha_y_no_importa_conflictos(self):
        m = {"criterio_vinculacion":"nombre_unico","recetas":[{"estado":"listo"},{"estado":"listo_documento"},{"estado":"conflicto_nombre"}]}
        self.assertEqual(len(modulo.plan(m)),2)
    def test_manifiesto_anterior_no_se_usa_por_accidente(self):
        with self.assertRaises(ValueError): modulo.plan({"recetas":[]})
    def test_nombre_unico_verificado_y_padron_sin_duplicados(self):
        r = [{"paciente_id":"p1","nombre_interno":"ANA PRUEBA","nombre_archivo":"Ana Prueba"}]
        previos = {"p1":{"nombre":"ANA","apellidos":"PRUEBA"}}
        modulo.verificar_identidades(r,previos,{"ana prueba":["p1"]})
        with self.assertRaises(ValueError): modulo.verificar_identidades(r,previos,{"ana prueba":["p1","p2"]})
    def test_cambiar_paciente_en_manifiesto_no_engana_al_importador(self):
        r = [{"paciente_id":"p2","nombre_interno":"ANA PRUEBA","nombre_archivo":"ANA PRUEBA"}]
        with self.assertRaises(ValueError):
            modulo.verificar_identidades(r,{"p2":{"nombre":"OTRA","apellidos":"PRUEBA"}},{"otra prueba":["p2"]})

if __name__ == "__main__": unittest.main()
