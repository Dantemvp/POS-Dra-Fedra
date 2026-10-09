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

- 522 registros candidatos a importar, con paciente único, fuentes concordantes, fecha y tratamiento; 1577 renglones.
- 21 copias duplicadas por hash.
- 675 conflictos entre nombres y 5 conflictos de paciente.
- 3374 archivos con varios candidatos de nombre interno.
- 6377 sin coincidencia de paciente, 15 sin fecha y 60 sin tratamiento.

El manifiesto clínico permanece fuera de Git. No se ha importado ningún registro. Debe resolverse el cotejo pendiente antes de completar la carga de todas las recetas; no se asignan por similitud.
