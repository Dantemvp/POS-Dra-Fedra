# Tema y cortes por área

Base: main 303e77c, producción anterior 0.1.33. Autor: Codex. Claude aprobó el SHA 624019d en el comentario 6131815178 del PR #49. Dante autorizó preparar reversa, corregir el rótulo y publicar la 0.1.34. El delta de publicación solo cambia ese rótulo, versión, prueba de render y documentos. No hay migraciones, dependencias nuevas ni cambios de datos.

## Tema

El shell y la cabecera usan superficies propias en claro y oscuro. El menú activo y los botones principales conservan blanco sobre verde; el logo de navegación cambia a blanco en oscuro. La selección de área y sus textos siguen el tema. Los botones de tema de escritorio y celular observan la misma clase del documento.

La selección de área ya no depende de un pequeño cambio de fondo: Farmacia tiene verde e icono de cápsula; Consultorio, rosa oscuro e icono de estetoscopio. El botón seleccionado dice `✓ Activa`; el otro, `Cambiar área`. Un indicador en la cabecera permanece visible al plegar la barra lateral y con el menú móvil cerrado. Las rutas de cada área mandan sobre parámetros antiguos; las rutas compartidas conservan el área en el enlace y se identifican como gestión compartida.

Farmacia usa `/logo-farmacia.png` (Aldama Farmacéutica) y Consultorio `/logo.png` (Dra. Fedra Aldama), tanto en navegación de escritorio como en cabecera y menú móvil. El logo de farmacia conserva una pequeña superficie blanca en oscuro porque el PNG tiene fondo blanco. No se invierte ese archivo ni se alteran los originales. Los comprobantes de corte de Farmacia también llevan su logo; los clínicos conservan el de la doctora. Los cortes antiguos sin alcance comprobado conservan la marca general.

El membrete permanece tenue. El logo del ticket no recibe el filtro de navegación. Los comprobantes de corte ahora usan `doc-imprimible`, con su paleta clara, incluso al verlos en pantalla oscura. Se conserva el ancho útil de 72 mm y la impresión automática después de guardar un corte.

## Cajas

- `/caja`: Farmacia. Solo ventas pagadas no históricas y sus pagos. Ni siquiera consulta cobros clínicos.
- `/cobros/corte`: Consultorio. Solo cobros activos y sus pagos. Ni siquiera consulta ventas de productos.
- `/cortes/resumen`: administración, gerencia y doctora consultan ambas áreas. Suma operaciones, no cortes guardados. No tiene cierre ni efectivo contado.

Los permisos no se amplían. Farmacia puede cerrar su área; administración y gerencia pueden cerrar ambas, por separado. Doctora y asistente consultan la caja clínica sin botón de cierre. La doctora conserva acceso al historial y al resumen. No se concede a Farmacia acceso a la ruta clínica ni a expedientes.

El servidor valida el área y vuelve a calcular los importes; no acepta un cierre combinado. El contado sigue siendo el único importe capturado por la persona. Cada corte guarda su área en `desglose.__area_corte`: 1 Farmacia, 2 Consultorio. Es metadato, nunca dinero ni método de pago. La marca anterior `__solo_farmacia` se mantiene por compatibilidad.

El historial filtra por área. Reimpresión y CSV usan el alcance guardado, no el rol actual del autor. Recuperar el último corte propio filtra autor y área; solo recupera los cortes con la nueva marca. Los anteriores siguen disponibles en el historial, sin reescribir sus cifras ni atribuirlos a una nueva área.

La campana consulta el último cierre de cada área por separado. Un cierre de Farmacia no adelanta la frontera de Consultorio. Los cortes antiguos que declararon incluir ambas áreas sirven como frontera para ambas; los que no declararon alcance no acreditan ese cierre. La lectura falla si supera el límite, no muestra una lista incompleta como comprobada.

## Límites y reversa

Separar los ingresos no implica que existan dos cajones físicos. Antes de capturar contado, separar el efectivo atribuible a cada área. El sistema no incluye fondo inicial ni retiros. Sigue sin garantizar un único corte por turno ni una transacción atómica entre lectura y guardado; los resúmenes diarios pueden solaparse. Esta ronda no cambia ese contrato.

La reversa compatible quedó preparada en `codex/reversa-0.1.33-area-cortes`, commit `79819bf408f48d96a9d26c7a2ab60ee3ba6a07f6`, basada en main 303e77c. Conserva lector, CSV, comprobante y detalle de cortes del código aprobado; la caja anterior no recupera un corte clínico como combinado. Pasan 145 pruebas, tipos, lint y build con variables ficticias. Si ya existen cortes con `__area_corte`, desplegar esa referencia compatible, nunca promover la 0.1.33 original ni revertir el PR a secas. Los datos no se borran. No usar `db push` ni ejecutar migraciones para esta entrega.

## Verificación de Codex

158 pruebas Node pasan, tipos, lint y build limpios. Las nuevas pruebas cubren lecturas separadas, rechazo del área indebida, snapshots, recuperación por autor/área, CSV, render del ticket clínico, permisos de consulta, resumen sin cierre y campana con fronteras independientes. Se añaden seis pruebas de identidad por área: selección por ruta y rol, conservación en vistas compartidas, marcas, texto de selección y encabezado independiente del menú. Los renders de corte verifican el logo de cada área.

Harness aislado: `node tests/manual/panel-demo-server.mjs --tema`, puerto 3034. Usa React, navegación y comprobante reales, pero datos inventados, enlaces locales y logout simulado. No conecta Supabase; bloquea `window.print`. No acredita una sesión real por rol ni impresión física.

En el navegador se comprobó claro/oscuro, sincronización de controles, logo visible, papel blanco y menú móvil. A 320 y 390 px no hubo desbordamiento horizontal. En los 21 elementos medidos en oscuro, el contraste mínimo fue 6.66:1. No es una auditoría de todas las pantallas ni de todos los estados de hover. Los números del tema claro no se certificaron porque el navegador devuelve colores OKLCH y el medidor inicial solo convertía RGB.

En el delta de identidad, las etiquetas seleccionadas sí devuelven RGB: Farmacia tiene 9.05:1 en claro y 10.42:1 en oscuro; Consultorio, 6.88:1 y 9.43:1. El botón inactivo tiene 8.94:1 en claro y 11.43:1 en oscuro. Son mediciones del estado quieto, no una certificación de toda la app. Se comprobó el indicador con barra plegada y los dos logos en celular. Al terminar, se cerró la pestaña del harness y se detuvo su servidor; no quedan formularios ni registros ficticios de este harness en producción.

## Prueba supervisada con Fer después de publicar

1. Revisar menú, botones, logo y campos en ambos temas desde PC y celular. Comprobar que el ticket sigue negro sobre blanco.
2. Cotejar ventas y cobros de un día: cada área debe excluir la otra, y el resumen conjunto debe sumar exactamente una vez cada operación.
3. Reimprimir primero un corte existente. Después cerrar un corte de cada área con administración o gerencia, usando contado atribuible al área. Comprobar folio, pagos mixtos, CSV y exclusión explícita de la otra caja.
4. Confirmar con Dante si Fer debe cerrar Consultorio y si usan uno o dos cajones. Cambiar permisos o incorporar fondos/retiros requiere una entrega propia, no un cambio visual.
