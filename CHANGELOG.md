# Historial de versiones

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
