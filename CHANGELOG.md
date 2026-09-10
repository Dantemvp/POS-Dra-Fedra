# Historial de versiones

## [0.1.10] - 2026-09-09

- Ajusta la máscara de métricas al ancho real del texto para no cortar la
  ilustración derecha del membrete.
- Permite crear viñetas y sangrías dentro de dosis y aclaraciones mediante
  asteriscos o la tecla Tab.

## [0.1.9] - 2026-09-09

- Coloca los controles de ajuste en un panel lateral para mantener visible la
  receta mientras se modifica.
- Oculta las métricas impresas por defecto y permite mostrarlas con una casilla.
- Permite guardar en una sola transacción el texto, orden, fase y configuración
  visual de la receta.

## [0.1.8] - 2026-09-09

- Añade un modo de ajuste previo a la impresión que no modifica la receta
  clínica guardada.
- Permite editar y reordenar medicamentos, dosis y aclaraciones, agregar
  renglones y ajustar tamaño, separación y posición dentro de límites seguros.
- Mantiene la fase como cierre del texto impreso y conserva el bloqueo de
  desbordamiento antes de abrir el diálogo de impresión.

## [0.1.7] - 2026-09-09

- Coloca la etiqueta de fase después del último medicamento para evitar que se
  encime con el membrete o con el tratamiento.
- Reserva todo el espacio posterior a la fase para las anotaciones manuscritas
  de la doctora.

## [0.1.6] - 2026-09-09

- Impide imprimir recetas cuyo contenido invade la franja reservada para el
  código de barras y el folio.
- El control falla cerrado si no puede medir el documento y explica cómo
  corregir una receta demasiado larga.
- Corrige la semántica de la lista de medicamentos sin alterar su apariencia.

## [0.1.5] - 2026-09-09

- Sube la etiqueta de fase de la receta: se encimaba sobre la palabra "PESO:"
  impresa en el recetario.

## [0.1.4] - 2026-09-09

- Corrige el ajuste del código de barras de la receta: la medida que genera
  JsBarcode trae unidad y un viewBox no la admite, así que el navegador lo
  descartaba y el dibujo salía recortado por la derecha.

## [0.1.3] - 2026-09-09

- La receta deja en blanco la columna de peso, estatura, IMC, peso ideal, peso
  sugerido y cintura, para que la Dra. Fedra anote ahí la evolución a mano.
- La fase pasa a una etiqueta destacada arriba de esa columna.
- Cada medicamento abre con asterisco y lleva su duración junto al nombre.
- La posología y las aclaraciones bajan a renglones propios y conservan sus
  saltos de línea, en lugar de unirse en una sola línea.
- El código de barras del folio ya no se imprime fuera de la hoja ni encima de
  la línea de firma: ahora se ajusta al área que se le asigna y va abajo a la
  izquierda, sobre el folio.

## [0.1.2] - 2026-09-09

- Retira la conexión OAuth y la sincronización de escritura con Google Calendar.
- Conserva la agenda interna, sus citas y los recordatorios por WhatsApp.
- El Inicio consulta únicamente el área visible, en lugar de cargar Farmacia y
  Consultorio al mismo tiempo.
- Añade respuesta visual inmediata durante la navegación entre pantallas.

## [0.1.1] - 2026-09-09

- Organiza el panel en las vistas Farmacia y Consultorio sin eliminar opciones.
- Conserva las rutas y permisos existentes para cada rol.
- Añade accesos rápidos y un inicio específico para cada área.
- Integra el logo, la paleta y las formas del membrete de la Dra. Fedra.
- Mantiene la identidad visual fuera de recetas, historias y tickets impresos.

## [0.1.0] - 2026-08-12

- Línea base identificada en el commit `ae7aaed` y el despliegue productivo
  `sistema-fedra-8x4uge5y0-dantemvps-projects.vercel.app`.
