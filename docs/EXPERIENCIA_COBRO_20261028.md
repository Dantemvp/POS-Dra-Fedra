# Experiencia de cobro, 28 de octubre de 2026

## Alcance y estado

Dante pidió un POS más sencillo, elegante y rápido, con una ventana para cobrar. Esta primera entrega modifica la preparación y confirmación de pagos en Farmacia y Consultorio. No constituye un rediseño completo del expediente, agenda, inventario o dashboard.

Base comprobada: main 1b26e83, versión 0.1.36. La propuesta no cambia versión ni está publicada. Requiere revisión independiente antes de integrar y autorización de Dante antes de desplegar.

## Cambios

### Farmacia

El carrito muestra el nombre completo, precio por unidad y controles de cantidad de 44 px con etiquetas accesibles. Buscar o escanear agrega al carrito; Continuar al cobro abre la ventana sin registrar nada. La ventana identifica el área, muestra el total, los cuatro métodos y la combinación de dos pagos. Con efectivo se conserva la captura opcional de recibido y el cálculo de cambio. Una captura insuficiente o inválida impide confirmar.

La confirmación conserva el contrato de cobrar y registra una sola llamada por pantalla mediante un bloqueo inmediato con ref. Solo el éxito abre el ticket existente, con su impresión automática, logo y QR. Un rechazo permite corregir y reintentar. Si la llamada lanza una excepción, la pantalla indica un resultado incierto y bloquea otro cobro; no afirma que la venta haya fallado. Se debe revisar Caja y reportes.

### Consultorio

La captura ocupa una columna, con paciente y conceptos primero. Los productos adicionales y los cobros recientes empiezan plegados. El precio se precarga al elegir un servicio. La ventana de pago muestra el paciente elegido y permite conservar la nota. Volver o Escape no borran los conceptos ni el pago preparado. El borrador sigue usando sessionStorage, con el manejo de errores existente.

El cobro exitoso conserva la navegación a /cobros/ID?imprimir=1. La pantalla queda bloqueada hasta navegar, para evitar un segundo registro. Rechazos y resultados inciertos se tratan como en Farmacia. Descartar también limpia los campos del pago dividido. Los productos no se agregan por encima de su existencia local; el servidor mantiene la validación definitiva.

### Diseño y accesibilidad

Ventana nativa dialog con showModal, fondo inerte, nombre accesible, retorno de foco, Escape y un ciclo explícito de Tab/Shift+Tab. Durante el registro no permite cerrar ni cambiar el pago. El foco inicial queda en Volver, nunca en Confirmar, para evitar cobrar al pulsar Enter por accidente.

En celular funciona como panel inferior. El encabezado y la confirmación permanecen visibles; solo el contenido central se desplaza. Los métodos usan texto, marca de selección y aria-pressed. El selector de pacientes permite flechas, Enter y Escape, y busca con o sin acentos. Los estilos nuevos respetan claro/oscuro y no cambian fuentes de documentos imprimibles.

Referencia técnica: [dialog en MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog).

## Respuesta y límites de rendimiento

Se crea un índice en memoria al recibir el catálogo. Los códigos e IDs usan Map, y los nombres se normalizan una vez. Buscar devuelve como máximo seis coincidencias, sin recorrer el resto tras encontrarlas; admite consultas sin acentos. El código conserva la primera coincidencia de un código duplicado, igual que el find anterior.

En un microensayo local de 2,000 productos y 1,000 consultas, construir el índice tomó aproximadamente 2.75 ms, y la mediana de la búsqueda fue 0.0013 ms. Esto mide únicamente una función en Node, no la carga de una página ni Supabase. La prueba automatizada evita umbrales temporales frágiles y comprueba que las consultas no vuelven a leer/normalizar los nombres.

En el harness se observó con eventos Network.requestWillBeSent que abrir la ventana, capturar recibido y pulsar Enter en ese campo no disparó solicitudes. Tampoco registró un cobro. No se midió la latencia productiva de registrar ventas o de cargar las páginas. Plegar cobros recientes NO difiere la consulta: sus cuatro lecturas siguen ejecutándose en paralelo.

## Verificación

Pruebas Node del flujo y componentes, más la suite existente. Incluyen 400 combinaciones de pagos mixtos al centavo, captura insuficiente, montos inválidos, doble confirmación, cancelación sin pérdida, bloqueo tras resultado incierto, rutas de impresión, ausencia de envío automático, búsqueda y teclado. Build, tipos, lint y diff-check se verifican antes del PR.

El harness usa los componentes reales y reemplaza las acciones mediante alias de webpack. La impresión incrementa un contador; el router de Consultorio muestra la ruta solicitada en lugar de navegar a la base. Por ello el flujo clínico queda visualmente en espera después del éxito ficticio: no es una prueba del ticket clínico renderizado. Farmacia sí monta su ticket real con datos inventados y produjo una impresión simulada.

Se probaron ambas áreas, claro/oscuro, 320 y 390 px y escritorio. Se comprobó el botón de confirmar dentro de la pantalla, el ciclo de teclado, el retorno de foco, búsqueda del paciente sin acentos, rechazo, resultado incierto y conservación de datos al volver. La prueba fue solo en el navegador disponible; quedan Safari/iPhone, lector físico y térmica de la clínica.

Para reproducir después de npm run build:

```powershell
$env:FEDRA_DEMO_PORT='3042'
node tests/manual/panel-demo-server.mjs --cobro
```

Visitar /?area=farmacia o /?area=consultorio. Agregar &modo=error o &modo=incierto para los fallos ficticios. El lector de prueba acepta 7501111111111 y 7502222222222. La receta ficticia REC42 carga un producto de demostración. Detener únicamente el servidor propio al terminar.

## Conservado y pendiente

No se modifican acciones del servidor, RPC, Supabase, migraciones, permisos, OAuth, WhatsApp, documentos clínicos ni AutoPrint. No se realizaron ventas/cobros/cortes reales ni impresión física. No se agregó una dependencia.

La protección de duplicados es local a esta pantalla y no sustituye idempotencia entre computadoras ni después de recargar. El servidor sigue siendo la autoridad para inventario, importes y roles. No se extrajeron pacientes ni credenciales para las pruebas.

Siguiente pasada propuesta: aplicar el mismo orden de tareas a Inicio/Agenda y a captura de pacientes, y medir navegación y lecturas reales en un entorno de prueba autorizado. No se consideran ejecutadas por este PR.
