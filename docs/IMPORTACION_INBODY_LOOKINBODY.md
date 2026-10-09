# Hojas históricas de LookinBody

La importación añade las hojas exportadas al bloque Historial InBody del expediente. Conserva cada estudio por separado, con su fecha. No convierte una imagen en un paciente ni reemplaza estudios anteriores del mismo paciente.

## Identificación

`scripts/migracion/preparar-inbody-lookinbody.py` cruza el ID y la fecha/hora del nombre del JPG con las columnas ID y Test Date / Time del Excel original. Exige una sola fila del Excel para esa combinación. El nombre completo de esa fila debe coincidir con un único paciente vigente del POS, ignorando mayúsculas, acentos y puntuación.

Las coincidencias ambiguas, nombres sin paciente y archivos sin estudio correspondiente quedan en el cotejo privado. No se asignan por parecido ni se crean pacientes automáticamente. El importador comprueba nuevamente la identidad contra el padrón remoto antes de subir.

Cada JPG entra en un PDF de una página que conserva su proporción y los bytes del JPEG original, sin OCR, IA, recorte ni recompresión. Un archivo corresponde a una hoja exportada, no demuestra que LookinBody haya exportado otros tipos de informe del mismo estudio. Si aparecen hojas adicionales, deberán conservarse y cotejarse también.

## Ejecución

Usar Python con openpyxl, Pillow y reportlab. Para las pruebas de conservación de bytes se necesita pypdf. No instalar estas librerías como dependencias de ejecución de Next.

```text
python scripts/migracion/preparar-inbody-lookinbody.py --images <carpeta-JPG> --excel <Excel-original> --patients <padron-vigente.json> --output <carpeta-privada-nueva>
python scripts/migracion/importar-documentos-historicos.py --manifest <salida/manifest.json> --report <reporte-privado-nuevo.json>
```

El primer comando solo prepara archivos locales; el segundo, sin `--apply`, comprueba las huellas y muestra el conteo. Añadir `--apply` únicamente con autorización de carga a producción. El acceso remoto usa la sesión del CLI del propietario y conserva la credencial de servicio solo en memoria.

El manifiesto mantiene el campo `recetas` por compatibilidad con el importador anterior, pero `tipo_documento=inbody` determina el tipo real y la ruta `inbody/{paciente}/{sha256}.pdf`. La ausencia de ese campo conserva el comportamiento de importación de recetas.

## Acceso y reversa

Se reutilizan la tabla `archivos_paciente_historicos`, el bucket privado `historicos-clinicos` y las políticas clínicas existentes. No hace falta otra migración para esta carga. La app conserva los InBody estructurados anteriores junto a las hojas históricas, y separa estas últimas de las recetas originales.

El enlace verifica rol clínico y pertenencia al paciente en el servidor antes de generar una URL temporal. No se publican los objetos ni las credenciales.

Antes de cargar, el importador respalda los metadatos existentes fuera de Git. El reporte identifica las altas nuevas y sus rutas. Si se autoriza una reversa, retirar únicamente objetos y filas con `nuevo=true` en esa corrida; no vaciar tablas ni eliminar originales locales. Un reintento no sobrescribe objetos y omite metadatos con la misma combinación paciente, tipo y huella.

Los Excel, JPG, PDFs, padrones, manifiestos y reportes clínicos permanecen fuera del repositorio. Git contiene código, pruebas sintéticas y conteos agregados, nunca nombres de pacientes reales.

## Carga del 9 de octubre de 2026

- Padrón vigente consultado: 550 pacientes. Carpeta recibida: 5150 JPG, correspondientes a los 5150 estudios del Excel por ID y fecha/hora. Cero estudios del Excel sin imagen.
- Carga autorizada completada: 833 hojas nuevas para 292 pacientes, cero fallos. Cada uno de los 833 PDF conservó los bytes del JPEG original.
- Pendientes de identidad: 4313 hojas sin coincidencia exacta en el padrón y 4 con nombre ambiguo. Se conservaron localmente y se generó una lista privada agrupada por nombre e ID de LookinBody. No se crearon pacientes.
- Verificación remota: 833 vínculos con paciente, huella y fecha correctos; cinco descargas con SHA-256 idéntico; 543 documentos previos intactos; bucket privado.
- Respaldo previo, manifiesto, reporte de altas y verificación en la carpeta externa `inbody-lookinbody-20261009`. No hay documentos clínicos dentro de Git.
- No hubo migraciones, merge ni despliegue en este paso. Los datos están cargados; la interfaz permanece en el PR 37, pendiente de revisión independiente y publicación.
