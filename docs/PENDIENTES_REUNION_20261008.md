# Acuerdos del 8 de octubre de 2026

## Implementado en la rama, pendiente de revisión y publicación

- Farmacia abre la impresión al registrar una venta confirmada. Espera fuentes y logo, imprime una vez por comprobante y conserva reimpresión.
- Consultorio muestra un ticket obtenido del cobro guardado y abre la impresión al finalizar. Incluye logo de consultorio, referencia, paciente, conceptos, pagos, nota y QR. Permite reimpresión desde el historial.
- Corte del día: imprimir, guardar PDF desde el diálogo y exportar CSV para Excel.
- Lector: desactivar autocorrección, capitalización y revisión ortográfica en el campo de escaneo.
- Inventario: el Enter del lector en el código de barras ya no envía los formularios de alta ni edición.
- Pagos mixtos de Consultorio: dos métodos y sus montos, borrador persistente y validación transaccional en la migración 047. Aplicar la migración antes de publicar la app.
- PR 37: cotejo de recetas con nombres concordantes, fecha y tratamiento obligatorios; duplicados por hash; manifiesto fuera del repositorio; huella del padrón.
- Plantillas: 61 tratamientos actuales; conservar versiones anteriores y mantener plantillas personalizadas. El reintento conserva ediciones posteriores.

## Ajustes tras la segunda revisión de Claude

- Consultorio consume `imprimir=1` antes de abrir la impresión. Recargar la URL ya consumida no solicita otro ticket; el botón de reimpresión sigue disponible.
- CSV de cortes guardados: fecha y hora de Sinaloa, una fila por pago y total de operación escrito una sola vez. Los pagos sin desglose se señalan, no se inventa un método.
- Cobros simples y mixtos usan el mismo núcleo privado. Redondean cada subtotal a centavos, suman esos subtotales y escriben solo los pagos definitivos. Se conservan las firmas públicas, validación de sesión y roles, descuento FIFO y reversa transaccional. La 047 ahora reemplaza también el cuerpo de `registrar_cobro`; requiere revisión de ese delta antes de aplicarse.
- Una plantilla personalizada vacía ya no cancela la 046. La comprobación de contenido cubre las 61 plantillas de esta entrega, sin modificar las personalizadas.
- El manifiesto obsoleto del padrón de 520 pacientes se apartó a `obsoletos-padron-520/NO-USAR-manifest-padron-520.json`, fuera de Git, conservando su SHA-256. No se eliminó.
- El criterio estricto separó 34 recetas de 16 grupos por misma fecha. Dante autorizó después importar por nombre único, sin bloquear por misma fecha, falta de fecha o tratamiento. El modo `--por-nombre` vincula esos originales como documentos, sin fusionarlos ni emitir nuevas recetas.
- Privacidad pendiente: los commits antiguos `9ba4e85` y `d3ac822` siguen accesibles por identificador en GitHub. La reescritura de rama no equivale a purga. Falta solicitar la eliminación a GitHub Support y decidir la visibilidad del repositorio. No incluir datos clínicos en el trámite público.
- Dependencias de ejecución: Next y su configuración de lint fijados en 16.3.8; DOMPurify 3.4.16, sharp 0.35.5 y source-map-js 1.2.2 en el lockfile. `npm audit --omit=dev` vuelve a cero. El audit completo conserva cinco avisos altos en la cadena de lint (`braces` y sus dependientes); no se aplicó `--force`, que propone bajar la configuración de Next a una versión mayor anterior. Ese pendiente de herramientas no equivale a cinco fallos en producción.

## Siguiente desarrollo

2. Anticipos por paciente y tratamiento: registrar, aplicar al saldo una sola vez y permitir revisar el historial. Crear un servicio llamado Anticipo no implementa saldo a favor.
3. Compra sin expediente: nombre y teléfono de cliente, sin crear historia clínica.
4. Cobrar servicios en Farmacia respetando permisos y contabilización.
5. Resumen de recetas más legible en celular y panel móvil de pendientes, existencias bajas y caducidades.
6. Agenda y mensaje de WhatsApp con políticas confirmadas.
7. Archivos LookinBody y sincronización periódica.
8. Importación histórica con padrón vigente, respaldo fresco y resolución de coincidencias pendientes.

## Información que debe entregar el consultorio

- Catálogo de servicios con precios y ubicación.
- Montos de anticipos y aplicación a programas de varias fases. En la llamada: combinado 1000, inyectado 600, tomado aproximadamente 500, pendiente de confirmación.
- Texto de confirmación de cita y políticas de reagendación.
- Confirmación de dosis y duraciones dudosas en los PDF originales.

## Prueba física de impresión

La aplicación abre la impresión automáticamente. El envío sin diálogo requiere configurar el navegador del equipo conectado a la POS-8360 y elegir esa impresora como destino. Debe probarse en ese equipo; imprimir desde el celular requiere una conexión compatible o un puente de impresión.

Confirmar papel de 80 mm, escala, ticket completo con QR, cajón si está conectado, papel agotado y reimpresión sin registrar otra venta. Revisar además si el Enter del lector envía formularios de inventario al capturar el código.

Las credenciales y las transcripciones con datos personales quedan fuera del repositorio.

## Cotejo histórico con padrón vigente

Consulta de producción del 8 de octubre: 550 pacientes. Barrido completo de 11049 PDF, sin sugerencias aproximadas:

- 543 documentos vinculables por nombre único: 522 con fecha y tratamiento extraíble, y 21 que se conservan como PDF sin exigir esos campos.
- Repetir fecha no bloquea la importación autorizada. El mismo archivo por hash no se duplica.
- 21 copias duplicadas por hash.
- 675 conflictos entre nombres y 5 conflictos de paciente.
- 3374 archivos con varios candidatos de nombre interno.
- 6377 sin coincidencia de paciente. Los conflictos de identidad siguen separados: no se asignan a otra persona por aproximación.

El manifiesto clínico permanece fuera de Git. La autorización permite vincular por nombre único. No exige reconstruir medicamentos ni fecha para conservar el original. No se asignan documentos con identidad contradictoria o ambigua.

El manifiesto vigente es `manifest-autorizado-por-nombre.json`, en el respaldo externo `auditoria-recetas-20261008`. El manifiesto estricto anterior es evidencia del cotejo, no el criterio final autorizado.

## Archivo histórico privado

- Migración `20261009012941_archivos_historicos_paciente.sql` aplicada a producción por la importación autorizada. Su versión coincide con el registro remoto. No se aplicaron la 046 ni la 047 en este paso.
- Bucket privado `historicos-clinicos` y tabla `archivos_paciente_historicos`, solo lectura para roles clínicos. Farmacia no lee metadatos ni objetos; las sesiones de la app no sobrescriben ni borran originales.
- `scripts/migracion/importar-documentos-historicos.py` comprueba padrón vigente, huellas de PDFs, bucket privado y genera respaldo de los metadatos anteriores y reporte privado de cada alta. El reintento usa ruta por hash y no sobrescribe.
- Las recetas originales aparecen en el expediente en el bloque "Recetas históricas originales" y las hojas de LookinBody en "Historial InBody" cuando se publique la app. El enlace autoriza al usuario clínico en servidor y genera una URL de 60 segundos. Sin fecha original se muestra así, sin inventarla.
- No se modifica `recetas`, no se generan folios, no se cobra y no se mueve inventario. El importador admite recetas e InBody; las hojas LookinBody se cotejan por ID y fecha/hora contra el Excel y por nombre único contra pacientes. No reconstruye mediciones ni cambia valores clínicos. Ver `IMPORTACION_INBODY_LOOKINBODY.md`.
- Carga terminada: 543 PDFs originales y 543 registros nuevos, cero fallos. Reporte y respaldo previo de metadatos en `auditoria-recetas-20261008`, fuera de Git. La interfaz nueva permanece en el PR 37, todavía no publicada.
- Reversa de la carga: usar solamente los IDs y rutas con `nuevo=true` del reporte. Retirar primero esos objetos mediante Storage y después esas filas. No vaciar tablas, no borrar registros preexistentes y no borrar los originales locales. La publicación de interfaz se revierte por Git/Vercel sin eliminar los documentos.
