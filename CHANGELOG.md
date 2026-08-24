# Historial de versiones

Este archivo sigue el formato de Keep a Changelog. Las versiones estables usan SemVer y corresponden a un tag de Git, un commit, un despliegue identificado y evidencia de verificación.

## [Sin liberar]

### Agregado

- Versión y commit visibles en login, menú móvil y barra lateral.
- Validación automática de consistencia entre versión, lockfile y tag.
- Bloqueo de builds productivos sin commit o con versión preliminar.
- Inventario reproducible de migraciones por commit o tag.
- Procedimiento de liberación y reversa.

## [0.2.0-rc.1]

Primera candidata para el tester aislado. No es una liberación de producción.

### Cambiado

- Impresión multipágina de historias clínicas sin desperdiciar hojas ante secciones largas.
- Bloqueo de recetas que rebasan el área imprimible y cálculo histórico de edad y fecha en Sinaloa.
- Lectura de InBody con modelo fijado, esquema estricto, límites de archivo y dos pasadas obligatorias.
- Diagnóstico verificable de notificaciones push, incluidas suscripciones caducadas.

### Verificación

- 42 pruebas de aplicación, lint, typecheck, build y auditoría de dependencias.
- Reconstrucción de las 40 migraciones en Supabase aislado con datos de prueba por rol.
- Pruebas externas de RLS, Storage y bitácora, con hallazgos abiertos conservados como fallos esperados.
- Candado global de archivos UTF-8 y ejecución única de CI por pull request.

### No incluido

- Ninguna migración o escritura contra producción.
- Ninguna importación del POS local anterior.
- Los cierres pendientes de Storage, alta pública, auditoría append-only e idempotencia.

## [0.2.0-dev.0]

Versión preliminar local. No representa todavía una liberación de producción.

### Incluido en la rama apilada

- Línea base de CI y pruebas puras.
- Corrección del cobro con efectivo insuficiente.
- Actualización de dependencias críticas de producción.

### Excluido

- FED-006 y FED-007, devueltos por revisión y no aptos para liberación.

La primera versión estable se nombrará `0.2.0` solo después de revisión cruzada, CI, autorización, respaldo restaurable y verificación del despliegue.
