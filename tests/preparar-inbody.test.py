import importlib.util
from pathlib import Path
import tempfile
import unittest
from PIL import Image
from pypdf import PdfReader

spec = importlib.util.spec_from_file_location('inbody', Path(__file__).resolve().parents[1] / 'scripts/migracion/preparar-inbody-lookinbody.py')
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

def fila(nombre='PERSONA FICTICIA', identificador='001', fecha='2026.10.08. 12:00:00'):
    r = [None] * 14
    r[0], r[1], r[13] = nombre, identificador, fecha
    return r

class InBody(unittest.TestCase):
    def test_identificacion_por_id_y_fecha_no_por_nombre_archivo(self):
        r, faltan = mod.cotejar([Path('001_20261008120000_InBody.jpg')], [fila()], [{'id':'p1','nombre':'Persona','apellidos':'Ficticia'}])
        self.assertEqual(r[0]['paciente_id'], 'p1')
        self.assertEqual(faltan, [])

    def test_nombre_ambiguo_o_desconocido_no_se_asigna(self):
        ps = [{'id':'p1','nombre':'PERSONA','apellidos':'FICTICIA'}, {'id':'p2','nombre':'PERSONA','apellidos':'FICTICIA'}]
        r, _ = mod.cotejar([Path('001_20261008120000_InBody.jpg')], [fila()], ps)
        self.assertEqual(r[0]['estado'], 'nombre_ambiguo')
        r, _ = mod.cotejar([Path('001_20261008120000_InBody.jpg')], [fila()], [])
        self.assertEqual(r[0]['estado'], 'sin_paciente')
        self.assertNotIn('paciente_id', r[0])

    def test_no_usa_fecha_equivocada_y_reporta_faltante(self):
        r, faltan = mod.cotejar([Path('001_20261008120100_InBody.jpg')], [fila()], [])
        self.assertEqual(r[0]['estado'], 'sin_estudio_excel')
        self.assertEqual(len(faltan), 1)

    def test_excel_ambiguo_se_rechaza(self):
        r, _ = mod.cotejar([Path('001_20261008120000_InBody.jpg')], [fila(), fila()], [])
        self.assertEqual(r[0]['estado'], 'estudio_excel_ambiguo')

    def test_varios_estudios_del_mismo_paciente_no_se_pierden(self):
        archivos = [Path('001_20261008120000_InBody.jpg'), Path('001_20261009120000_InBody.jpg')]
        filas = [fila(), fila(fecha='2026.10.09. 12:00:00')]
        r, faltan = mod.cotejar(archivos, filas, [{'id':'p1','nombre':'PERSONA','apellidos':'FICTICIA'}])
        self.assertEqual([x['paciente_id'] for x in r], ['p1', 'p1'])
        self.assertEqual(len(set(x['fecha_hora_local'] for x in r)), 2)
        self.assertEqual(faltan, [])

    def test_pdf_conserva_bytes_jpeg_y_es_determinista(self):
        with tempfile.TemporaryDirectory() as tmp:
            carpeta = Path(tmp)
            jpg = carpeta / 'hoja.jpg'
            Image.new('RGB', (164, 231), 'white').save(jpg)
            a, b = carpeta/'a.pdf', carpeta/'b.pdf'
            mod.pdf_de_jpg(jpg, a)
            mod.pdf_de_jpg(jpg, b)
            self.assertEqual(a.read_bytes(), b.read_bytes())
            page = PdfReader(a).pages[0]
            objects = page['/Resources']['/XObject'].get_object()
            self.assertEqual(len(objects), 1)
            self.assertEqual(next(iter(objects.values())).get_object().get_data(), jpg.read_bytes())
            self.assertAlmostEqual(float(page.mediabox.height)/float(page.mediabox.width), 231/164, places=5)

if __name__ == '__main__': unittest.main()
