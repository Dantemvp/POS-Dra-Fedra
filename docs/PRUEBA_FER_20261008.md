# Prueba con Fer - 8 de octubre de 2026

Objetivo: comprobar en el equipo y celular reales que Farmacia y Consultorio se
entienden, que el lector Bluetooth captura sin duplicar y que la POS-8360 imprime
un ticket completo y legible.

## 1. Orientación y celular

- [ ] Al entrar se distingue con claridad el área actual: Farmacia o Consultorio.
- [ ] Cambiar de área muestra únicamente las opciones de esa área, sin perder rutas.
- [ ] El botón de tema cambia entre claro y oscuro y conserva la elección al volver a entrar.
- [ ] En celular, el menú abre y cierra; ningún formulario, tabla o botón se sale de la pantalla.
- [ ] Los botones principales se reconocen sin tener que adivinar cuál guarda o cobra.

## 2. Lector Bluetooth montado en el celular

Preparación: emparejar el lector con el celular. Debe comportarse como teclado y
enviar `Enter` después del código.

- [ ] Abrir Farmacia > Punto de venta y tocar el campo "Lector Bluetooth".
- [ ] Escanear un producto conocido: aparece exactamente una vez con nombre y precio correctos.
- [ ] Escanearlo otra vez: aumenta una unidad, sin superar la existencia disponible.
- [ ] Escanear un código desconocido: aparece un error claro y el carrito no cambia.
- [ ] Escanear una receta `REC<folio>`: agrega solo los productos ligados y reporta los faltantes.
- [ ] Confirmar que el lector manda `Enter`; si solo escribe números, configurar sufijo CR/Enter.
- [ ] Bloquear y desbloquear el celular, volver al POS y repetir un escaneo.
- [ ] Escanear con el foco en cantidad o en otro buscador: confirmar dónde llega el código y volver al campo de escaneo antes de continuar.
- [ ] Hacer dos escaneos rápidos: códigos separados, dos unidades y ningún código concatenado.
- [ ] En iPhone, confirmar que el teclado y autocorrector no alteran `REC<folio>`.
- [ ] Confirmar que el idioma del teclado del lector coincide con el celular.
- [ ] En alta y edición de inventario, el Enter del lector no guarda el formulario.

## 3. Venta y ticket POS-8360

Configurar papel de 80 mm, escala 100 %, márgenes ninguno, encabezados y pies del
navegador desactivados, orientación vertical.

- [ ] Venta de un artículo y venta con nombres largos.
- [ ] Pago en efectivo: total, recibido y cambio correctos.
- [ ] Pago con tarjeta y pago mixto: desglose correcto.
- [ ] El cobro descuenta inventario una sola vez, aunque la impresión se cancele.
- [ ] El ticket inicia en el borde correcto, usa 72 mm útiles y no corta importes a la derecha.
- [ ] Logo, folio, fecha, persona que atendió, artículos, cantidades y precios son legibles.
- [ ] Razón social, RFC, régimen, domicilio y leyenda de facturación son legibles.
- [ ] El QR abre exactamente la página de reseña de Google.
- [ ] El cortador corta después del QR y no deja texto fuera del papel.
- [ ] Reimprimir el ticket no registra una segunda venta.
- [ ] Identificar el equipo conectado a la POS-8360. La captura desde celular no garantiza impresión desde ese celular.
- [ ] Con el perfil de impresión directa configurado, cobrar abre la impresión sin otro clic.
- [ ] Si se acaba el papel, reponer y reimprimir el comprobante existente sin cobrar de nuevo.
- [ ] Si hay cajón conectado, comprobar su apertura con el controlador real.
- [ ] Consultorio: cobro mixto, ticket con logo de la doctora y desglose de ambos pagos.
- [ ] Corte actual y corte guardado: imprimir/PDF y exportar CSV; comparar totales contra pantalla.

## 4. Consultorio

- [ ] Buscar un paciente y abrir su expediente desde celular y computadora.
- [ ] Expandir Recetas anteriores e Historial InBody sin mezclar ambos historiales.
- [ ] La asistente puede imprimir una receta guardada, pero no modificarla antes de imprimir.
- [ ] Crear una receta con una plantilla; revisar fase, medicamentos, dosis y espacio manuscrito.
- [ ] Abrir una historia clínica y verificar secciones, campos condicionales y PDF.

## 5. Plantillas nuevas

- [ ] El selector muestra 61 plantillas activas en seis categorías.
- [ ] Revisar con Fer una plantilla de cada categoría contra el PDF original.
- [ ] Confirmar que la plantilla NOTA debe seguir como opción independiente.
- [ ] Confirmar que Fase 3 y Fase 4 comparten la misma categoría.
- [ ] Verificar en especial KWIKPEN, MOUNJARO, RYBELSUS, SAXENDA y WEGOVY.

## Criterio para detener la prueba

Detenerse antes de seguir cobrando o imprimiendo si un escaneo agrega el producto
equivocado, si una venta se duplica, si el inventario no cambia una sola vez, si
el ticket corta importes o si una receta queda asociada al paciente incorrecto.
