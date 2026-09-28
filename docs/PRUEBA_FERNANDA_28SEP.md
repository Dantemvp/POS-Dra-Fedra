# Prueba con Fernanda, 28 de septiembre de 2026

## Cambios de la reunión anterior

- Receta: fase visible sin invadir el texto ni la zona manuscrita, formato vertical y métricas clínicas editables.
- Historia clínica: captura rápida, preguntas condicionales, IMC, ginecoobstétricos por sexo y firma del paciente.
- Plantillas: 54 tratamientos seleccionables y 147 medicamentos ordenados.
- Farmacia: inventario y punto de venta reorganizados, formularios plegables, filtros y carrito visible.

El código ya contiene estos cambios. En esta sesión se valida el uso real y la impresión física.

## Lector Eyoyo

1. Montarlo en el celular y emparejarlo por Bluetooth en modo HID.
2. Confirmar modo de carga inmediata, no modo almacenamiento.
3. Configurar sufijo Enter o CR desde el manual del lector.
4. Abrir el punto de venta y dejar activo el campo "Escanea o escribe el código".
5. Escanear un producto una vez. Debe agregarse una unidad al carrito.
6. Escanearlo otra vez. Debe subir a dos sin exceder la existencia disponible.
7. Probar un código no registrado. Debe mostrar el código y no agregar otro producto.
8. Probar un producto sin existencia. Debe rechazarlo sin borrar el carrito.
9. Confirmar que Android permita mostrar el teclado virtual aunque detecte el lector como teclado físico.

Si aparecen caracteres distintos a la etiqueta, revisar el idioma del teclado del lector. Si el código aparece pero no se agrega, comprobar el sufijo Enter.

## Impresora POS-8360

1. Instalarla como impresora de 80 mm mediante USB. Probar LAN después, no durante la primera validación.
2. En preferencias usar papel de 80 mm, escala 100 %, márgenes ninguno y desactivar encabezado y pie del navegador.
3. Hacer una venta ficticia con dos artículos, uno con cantidad mayor a uno, pago mixto y efectivo con cambio.
4. Imprimir y revisar que no se corte el borde izquierdo, los importes ni el QR. Todo el texto debe salir negro y legible, sin zonas transparentes.
5. Escanear el QR con dos celulares y confirmar que abre directamente la pantalla de reseña de Google.
6. Confirmar que el logotipo sea legible y que el cortador corte después del QR.

## Contenido esperado del ticket

- Logotipo y nombre de Aldama Farmacéutica.
- Folio, fecha y persona que atendió.
- Cantidad, descripción, precio unitario e importe por producto.
- Total, forma de pago, efectivo recibido y cambio cuando corresponda.
- Razón social, RFC, régimen fiscal, domicilio y código postal del emisor.
- Instrucciones para solicitar factura sin exigir Constancia de Situación Fiscal.
- Invitación y QR directo para dejar una reseña en Google.

El ticket es comprobante de la operación, no un CFDI timbrado. No debe imprimir información clínica del paciente.

## Preguntas para Fernanda

- ¿La farmacia tiene política de cambios o devoluciones que deba imprimirse?
- ¿El teléfono de facturación 668 152 6539 sigue siendo correcto?
- ¿Prefieren el QR antes o después de la leyenda de facturación?
- ¿El lector se usará con receptor USB, cable o Bluetooth?
