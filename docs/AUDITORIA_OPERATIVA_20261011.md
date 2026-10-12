# Revisión operativa del POS, 11 de octubre de 2026

Autor: Codex. Base: main `f68fba385143a71467dd3d4f44187a9061b113d8`, versión base 0.1.32. Rama de trabajo: `codex/panel-alertas-cortes`, entrega 0.1.33. Claude aprobó `e065539` en el comentario del PR #48. Dante autorizó corregir la leyenda del alcance y publicar; el ajuste posterior conserva en el JSON del corte si Consultorio está incluido y lo refleja en ticket, vista y CSV, sin cambiar importes ni permisos. Validación del ajuste: 142/142 pruebas, lint, tipos y build. No atribuir esa revisión del delta a Claude.

## Alcance y límites

Revisé el código y recorrí en el navegador Inicio de ambas áreas, Agenda, Pacientes, Recetas, Cobros, Servicios, Punto de venta, Inventario, Compras, Caja, Cortes, Movimientos, Usuarios y Notificaciones. Abrí un expediente de muestra y un corte guardado. Los módulos cargaron sin error de aplicación visible; esto acredita apertura y lectura, no todas sus acciones.

No creé pacientes, ventas, cobros ni cortes reales. No cancelé movimientos, edité expedientes, envié WhatsApp o push, cambié permisos ni imprimí en hardware. No ejecuté migraciones. Sí ejecuté consultas `BEGIN READ ONLY` en el proyecto productivo confirmado como Fedra POS: definiciones/atributos de funciones, restricciones, RLS y conteos, sin nombres, expedientes ni tokens. Las pruebas de lógica usan datos inventados; las conexiones de servidor se sustituyen por dobles. El harness de interfaz usa React y componentes reales con APIs ficticias, sin Supabase ni credenciales.

La comparación con Bianca se hizo sobre `pos/src/domain/corte.ts` del checkout `codex-release-0718`, no sobre una suposición del diseño. Bianca separa ingresos, egresos y efectivo; Fedra todavía no tiene ese mismo libro de caja. No importé reglas de apartados, sucursales o inventario de ropa.

## Mapa del recorrido

| Área | Qué comprobé | Qué falta para aceptación completa |
| --- | --- | --- |
| Inicio | Pantallas separadas por área; el panel anterior no leía Google | Validar con Fer las cifras y avisos de la candidata |
| Agenda y WhatsApp | Lectura Google/POS, mensajes individuales, sin vincular pacientes por nombre | Texto final de Fer y envío a un teléfono propio |
| Pacientes y expediente | Apertura, edición disponible, historiales de recetas e InBody visibles en la muestra | Captura y permisos con las cuentas reales de cada rol |
| Recetas e historia clínica | Rutas, controles existentes y pruebas locales de lógica | Papel físico, márgenes, sello, firma y legibilidad del código |
| InBody | Acceso desde el expediente de muestra y asociación existente | Cobertura de todas las importaciones y nuevos estudios; no se auditó documento por documento |
| Farmacia | Buscador compacto, carrito y lector disponibles | Dos escaneos rápidos, foco fuera del lector, idioma del teclado, última unidad y cancelación controlada |
| Inventario y compras | Formularios y tablas abren; existe captura de código y lote | Entrada real supervisada, caducidad, ubicación y cotejo físico |
| Cobros y servicios | Formularios abren; pruebas de pagos mixtos y borrador existentes | Cobro supervisado, red intermitente y conciliación contra caja |
| Caja y cortes | Fallos de impresión confirmados y cálculo trazado al almacenamiento | Prueba física y revisión del cierre recalculado antes de publicarlo |
| Movimientos y usuarios | Páginas abren; acciones sensibles no se ejecutaron | Revisar bitácora de las pruebas y acceso por rol real |
| Notificaciones | Existe activación por dispositivo, pero no una campana operativa | Push real, permisos del dispositivo y entrega con la app cerrada |

## Cambios preparados

### Campana e Inicio

La guía de feedback llevó a agrupar pendientes por área y a mostrar su prioridad con texto, no solo color. El número de la campana cuenta categorías activas, no mensajes sin leer. Abrirla no confirma citas, marca mensajes ni resuelve faltantes. Escape devuelve el foco al botón; también se puede cerrar con un clic fuera.

Consultorio: citas próximas de hoy de Google y POS, citas del POS por confirmar y contactos de los próximos siete días sin un teléfono válido. Google no informa una confirmación clínica del paciente, así que no se etiqueta cada evento de Google como "por confirmar".

Farmacia: lotes vencidos con existencia, lotes por caducar en 30 días, stock bajo según mínimo configurado, productos con existencia sin código y productos con precio cero o vacío. Son avisos para revisar, no bloqueos nuevos de venta o cambios de inventario.

Cada aviso de inventario abre la lista filtrada por su causa, no todo el catálogo sin contexto. Un producto con varios lotes puede contar varias veces en el aviso de lotes y una sola vez en la lista de productos. Abrir el producto permite cotejar sus lotes. Los formularios conservan el catálogo completo; el filtro solo afecta a la tabla y se puede quitar con Ver todo el inventario.

Caja: actividad posterior al último corte de hoy y diferencia en el último cierre de hoy. Son recordatorios de revisión; no un cierre automático. Doctora recibe el enlace a Cortes; Farmacia, el de Caja. Asistente no recibe cortes, ventas ni inventario en este endpoint. La nueva API comprueba sesión, perfil activo y rol antes de leer cada dominio. Respeta RLS con el cliente de la sesión, sin `service_role`.

Inicio del consultorio agrega próximas citas unificadas y el WhatsApp individual existente. Muestra ingresos del consultorio de hoy para doctora, admin y gerente; no agrega ese indicador a la asistente. El panel anterior de pacientes mantiene la etiqueta "citas del POS" para no confundirlo con Google. El gráfico de métodos de Farmacia ahora desglosa pagos mixtos desde `pagos`, en lugar de clasificarlos como "Otro" por la cabecera vacía.

Las lecturas visibles se actualizan cada 60 segundos y al volver a la pestaña. Google comparte peticiones simultáneas y lecturas hechas con menos de cinco segundos de diferencia entre campana y agenda, en memoria del proveedor React. No guarda datos clínicos en localStorage o service worker. Un cambio de sesión limpia la vista del nuevo panel y pide recargar. Una lectura fallida conserva el último dato con aviso, no convierte el fallo en cero citas.

### Ticket del corte

Hallazgo COR-01, media, confirmado: `caja/CorteDelDia.tsx` imprimía un bloque `doc-imprimible` sin `print-area`, mientras `globals.css` oculta todo lo que no tenga esa marca. Preparé un comprobante térmico dedicado, separado de los controles de captura.

Hallazgo COR-02, media, confirmado: `cortes/[id]/page.tsx` no tenía botón de impresión, exportación ni área imprimible. Ahora recibe el mismo comprobante, con los valores y desglose guardados. No reconstruye el encabezado a partir de ventas que después hayan cambiado. Los cortes antiguos sin desglose lo indican, sin inventar métodos.

El comprobante lleva logo, folio, fecha y rango en Sinaloa, responsable, farmacia, consultorio, total, métodos, efectivo esperado, contado, diferencia, productos, pacientes y firmas de entrega/recepción. Usa 72 mm útiles centrados, negro y fondo blanco aun con la app oscura. El papel de 80 mm y su largo los controla el driver. No lleva QR de reseña ni nombres de pacientes porque es un documento interno.

Cerrar corte e imprimir imprime después de recibir el folio guardado. La captura exige contado válido; cero debe escribirse, no se presume de un campo vacío. Una vista previa dice "sin guardar". Reimprimir y Exportar CSV no crean otro cierre. Una recarga del historial no imprime sola. Caja permite recuperar el último corte del propio usuario para reimprimir después de recargar o quedarse sin papel; no concede al cajero acceso nuevo a los cortes de otras personas.

El CSV contiene el resumen, métodos disponibles y fecha de Sinaloa. No es un libro de movimientos detallado ni una conciliación bancaria. Las firmas, el fondo inicial y retiros no se guardan en nuevas columnas. El ticket advierte que el esperado corresponde a ingresos registrados, no a todo el efectivo del cajón.

### Cálculo y cierre

Hallazgo COR-03, alta, confirmado en código y reproducción local: la acción anterior guardaba totales, diferencia y desglose enviados por el navegador. Una llamada con importes manipulados podía proponer un resumen distinto de los movimientos. Ahora el servidor vuelve a leer ventas pagadas no históricas y cobros activos, suma por método en centavos, calcula la diferencia y devuelve el folio. El cliente solo aporta el contado. La prueba manda totales falsos y comprueba que no llegan a la inserción.

La lectura anterior de Caja incluía cobros cancelados y podía transformar un error en listas vacías. La nueva lectura rechaza errores o resultados truncados; no permite cerrar cuando los pagos no cuadran con los ingresos. Un cierre doble antes del siguiente render hace una sola llamada. Un resultado de red incierto bloquea otro intento en esa vista y pide revisar el historial.

Esto no convierte el cierre en una transacción SQL atómica ni agrega idempotencia entre dos computadoras. La lectura y la inserción siguen siendo peticiones separadas. Una garantía de cierre único por turno necesitaría una regla de negocio y un contrato en la base. No prometo esa garantía con un botón desactivado.

## Riesgos operativos que no escondo ni mezclo en esta rama

1. INV-01, alta, confirmado en código y comprobación de metadatos productivos. Las RPC FIFO de venta/cobro ordenan por caducidad pero no excluyen lotes ya vencidos. El conteo operativo queda en un anexo local fuera de Git. No acredita productos distintos ni una inspección física de la farmacia; algunos datos provienen de importaciones históricas. La campana permite detectarlos; no impide que la RPC los descuente. Antes de pruebas con mercancía real, cotejar físicamente esos registros y revisar un candado de caducidad con la política del consultorio. No cambié RPC ni existencias aquí.
2. INV-02, alta, confianza de código y metadatos. La función vigente de venta de Farmacia comprueba stock y descuenta lotes sin `FOR UPDATE`; el núcleo de cobro de Consultorio sí bloquea lotes. Producción confirmó cero restricciones CHECK en lotes. Falta un ensayo aislado de dos cajas contra la última unidad. No afirmo haber provocado una sobreventa.
3. Notificaciones fuera de la app: los crons existentes siguen leyendo solo citas del POS, no Google. Además, el envío puede devolver cero si faltan VAPID o suscripciones. No activé ni probé push real. La campana nueva no necesita ese permiso y no promete avisos con la app cerrada.
4. Continuidad de caja: Fedra no tiene fondo inicial, retiros ni un cierre único por turno como Bianca. Los resúmenes diarios pueden solaparse. Los tickets nuevos lo declaran; no cambian esa política sin autorización.
5. Dispositivos: el lector Bluetooth del celular y la impresora de Windows son conexiones distintas. El perfil de Chrome de tickets debe conservar la POS y papel de 80 mm; recetas/HC usan otro perfil. No instalé drivers ni puente de impresión.
6. Plantillas de fases: comprobé que el PR #37 continúa abierto. Producción conserva 54 plantillas activas y la migración 046 no está registrada. La sustitución por las carpetas nuevas sigue pendiente; no doy ese trabajo por integrado ni lo aplico dentro de esta ronda de campana/cortes.

No hice un dictamen fiscal, sanitario o de protección de datos. Las siete tablas examinadas mantienen RLS y el núcleo privado de cobro no permite ejecución directa a anon ni authenticated, comprobado en producción. Eso no prueba la corrección de todas las políticas por fila ni todas las funciones históricas. Referencia técnica: [Supabase, seguridad por fila](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Pruebas y reversa

La línea base pasó 115 pruebas; la candidata pasó 137/137, lint, TypeScript, build y audit de producción con cero vulnerabilidades reportadas. Las nuevas pruebas cubren permisos de la API, perfiles inactivos, lectura incompleta, stock/caducidad en Sinaloa, aislamiento de Google/POS, uso compartido de lecturas, importes del cierre, pagos mixtos, doble clic, recuperación del propio corte, CSV y render del ticket. Estas comprobaciones son de Codex, no una revisión independiente.

En el navegador del harness ficticio comprobé el desplegable a 320 y 390 px. Encontré un desborde lateral de la primera versión y lo corregí; luego quedó dentro de ambas pantallas. Escape cerró el panel. La emulación de impresión mostró ancho 272.125 px, equivalente a 72 mm, texto negro y fondo blanco con el tema oscuro, sin desborde interno. No imprimí en hardware ni acredité corte de papel.

No hay migración ni dependencia nueva. La reversa del código consiste en revertir el commit de esta rama o mantener producción en 0.1.32. No se borran cortes guardados. La siguiente ronda requiere revisión independiente de Claude y autorización para publicar.

## Prueba corta con Fer

1. Abrir Inicio del consultorio y Agenda; cotejar una cita de Google y una del POS, su hora y el WhatsApp individual. Cambiar un evento ficticio y comprobar el siguiente refresco.
2. Abrir la campana en celular y escritorio; revisar que cada aviso vaya a su módulo y que abrirlo no cambie datos. Probar las cuentas de asistente, farmacia y doctora.
3. Revisar productos sin código/precio y lotes vencidos. Capturar un código en un producto de prueba; escanear dos veces, con Enter y sin autocorrección.
4. Reimprimir primero un corte existente en la POS. Ver logo, importes, firmas y papel. Después hacer un cierre supervisado con contado cero/correcto/distinto, en el entorno acordado. Reimprimir no debe cerrar de nuevo.
5. Cotejar un pago mixto con el ticket, el corte y el CSV. Cancelaciones y prueba de última unidad requieren un plan de datos de prueba, no improvisar sobre ventas de pacientes.
