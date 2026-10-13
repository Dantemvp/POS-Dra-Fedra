# Cierre compacto de Farmacia y Consultorio

## Alcance

La pantalla compartida coloca primero el contado de efectivo y el botón Guardar corte e imprimir. Los ingresos por método y el ticket empiezan plegados. El total visible pertenece únicamente al área seleccionada. Después de guardar, la pantalla muestra la respuesta del servidor y abre el ticket.

El comprobante permanece montado al plegarlo. Así no se vuelve a montar AutoPrint. En impresión, el contenedor vuelve a mostrarse mediante print:block.

Este cambio no modifica el servidor, permisos, tablas, migraciones, importes guardados, logos, CSV ni el motor de impresión. No permite editar cortes existentes. La autorización de correcciones mediante una cuenta de administración o de la doctora requiere otro cambio.

## Pruebas automatizadas

- Suite Node: 171 pruebas, incluidas siete nuevas del cierre compacto.
- Captura vacía no cierra, negativa se rechaza y cero se envía como cero.
- Dos clics antes del siguiente render hacen una sola llamada.
- Guardar abre el comprobante y usa el resultado del servidor, no la vista previa.
- Un error explícito conserva la captura y permite reintentar sin imprimir.
- Un resultado incierto bloquea el cierre y mantiene visible el aviso.
- Recuperar un corte no registra otro; volver conserva el contado.
- Ambos formularios empiezan con detalle y ticket cerrados.
- Se conservan las pruebas de permisos existentes.

## Prueba interactiva aislada

Ejecutar después de npm run build:

```powershell
$env:FEDRA_DEMO_PORT='3040'
node tests/manual/panel-demo-server.mjs --cierre
```

Solo escucha en 127.0.0.1. El harness reemplaza la acción del servidor por una respuesta ficticia y window.print por un contador. No utiliza Supabase ni manda trabajos al sistema operativo. El tipo importado de actions.ts desaparece al transpilar; el alias de webpack impide incluir la acción real.

Variantes:

- /?area=farmacia
- /?area=consultorio
- /?area=consultorio&consulta=si
- /?area=consultorio&modo=error
- /?area=consultorio&modo=incierto

Comprobaciones realizadas: éxito en ambas áreas, conteo vacío/cero/cuadrado/sobrante, retorno al contado tras recuperar, error explícito y resultado incierto, consulta sin permiso, ausencia de desborde a 320 y 390 px, claro y oscuro. El resultado ficticio del servidor difiere del inicial para comprobar su prioridad. Plegar y abrir deja un cierre y una impresión; Reimprimir incrementa solo el contador de impresiones.

En medio print, incluso plegado, el ticket tiene aproximadamente 72 mm y los controles de pantalla quedan ocultos. Esta comprobación no aprueba el hardware ni la impresión directa del driver.

## Límites conservados

Administración y gerencia cierran ambas áreas; Farmacia solo la suya. Doctora y asistente consultan. No se añade fondo inicial, retiros ni protección de idempotencia entre computadoras. Cuando hay un solo cajón compartido, se debe separar el efectivo por área. Los cortes guardados no se editan.

La publicación de este cambio queda pendiente de revisión independiente. La producción 0.1.35 contiene exclusivamente el PR #50, no este formulario compacto.
