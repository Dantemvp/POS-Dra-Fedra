import importlib.util
from pathlib import Path
import unittest
import hashlib
import json
import tempfile
from unittest.mock import patch
spec = importlib.util.spec_from_file_location("importador",Path(__file__).resolve().parents[1]/"scripts/migracion/importar-documentos-historicos.py")
modulo = importlib.util.module_from_spec(spec)
spec.loader.exec_module(modulo)

class Importador(unittest.TestCase):
    def test_tipo_no_permitido_no_abre_archivos_ni_cliente(self):
        with patch.object(modulo, 'Cliente') as cliente:
            with self.assertRaises(ValueError):
                modulo.importar({'criterio_vinculacion':'nombre_unico','recetas':[], 'tipo_documento':'otro'}, Path('no-usar.json'), True)
            cliente.assert_not_called()

    def test_inbody_tiene_prefijo_y_tipo_propios_sin_romper_recetas(self):
        for tipo in ('inbody', 'receta'):
            with self.subTest(tipo=tipo), tempfile.TemporaryDirectory() as tmp:
                carpeta = Path(tmp)
                paciente = {'id':'p1','nombre':'PERSONA','apellidos':'FICTICIA'}
                padron = carpeta/'pacientes.json'
                padron.write_text(json.dumps([paciente]), encoding='utf-8')
                pdf = carpeta/'hoja.pdf'
                pdf.write_bytes(b'pdf sintetico')
                sha = hashlib.sha256(pdf.read_bytes()).hexdigest()
                manifest = {'criterio_vinculacion':'nombre_unico','origen':str(carpeta),
                    'pacientes_fuente':str(padron), 'pacientes_sha256':hashlib.sha256(padron.read_bytes()).hexdigest(),
                    'recetas':[{'estado':'listo_documento','paciente_id':'p1','nombre_interno':'PERSONA FICTICIA',
                    'archivo_relativo':'hoja.pdf','sha256':sha}]}
                if tipo == 'inbody': manifest['tipo_documento'] = tipo
                enviados = []
                class ClienteFicticio:
                    def pedir(self, ruta, metodo='GET', datos=None, pdf=False):
                        if metodo == 'POST':
                            enviados.append((ruta, datos))
                            return {'Key':'ficticia'} if pdf else [{'id':'d1'}]
                        if ruta.startswith('rest/v1/pacientes?'): return [paciente]
                        if ruta.startswith('storage/v1/bucket/'): return {'public':False}
                        return []
                with patch.object(modulo, 'Cliente', ClienteFicticio):
                    modulo.importar(manifest, carpeta/'resultado.json', True)
                self.assertTrue(enviados[0][0].endswith(f'{tipo}/p1/{sha}.pdf'))
                self.assertEqual(enviados[1][1]['tipo'], tipo)
                self.assertEqual(json.loads((carpeta/'resultado.json').read_text())['resumen']['nuevos'], 1)
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
