# Migración del POS anterior de Fedra

Este procedimiento separa tres fuentes que no deben confundirse:

1. El POS local anterior, pendiente de inventario.
2. El Supabase productivo actual, que ya contiene información real.
3. El entorno tester, que usa exclusivamente datos de prueba hasta aprobar una importación.

## Regla de seguridad

No se borra, transforma ni importa información real durante el diagnóstico. Primero se conserva una exportación íntegra, se calcula su huella SHA-256 y se demuestra que puede abrirse o restaurarse. Los pacientes y documentos clínicos nunca se eliminan como parte de un reinicio operativo. Cualquier regla de retención clínica, fiscal o de farmacia requiere validación responsable aparte.

## Fase 1. Inventario de solo lectura

- Identificar aplicación, versión, motor de base de datos y ubicación física de sus archivos.
- Registrar tablas, columnas, conteos, rangos de fecha y relaciones.
- Separar pacientes, consultas, recetas, ventas, pagos, inventario, lotes, proveedores y catálogos.
- Detectar duplicados, campos vacíos, identificadores inestables, fechas inválidas y existencias negativas.
- Comparar conteos con Supabase sin copiar datos clínicos a documentos de trabajo.

Resultado: informe de calidad y correspondencia, sin cambios en ninguna fuente.

## Fase 2. Mapeo y ensayo

- Definir una llave de origen estable para que reintentar no duplique registros.
- Mapear cada campo antiguo al esquema vigente y declarar qué datos no tienen destino.
- Ensayar la conversión únicamente en el tester.
- Conciliar pacientes, dinero e inventario antes y después.
- Registrar errores permanentes por separado; un registro malo no bloquea los válidos.

Resultado: migración repetible con datos de prueba o una copia protegida autorizada.

## Fase 3. Decisión con Fedra

### Opción A. Migración selectiva

Conservar pacientes y documentos clínicos, depurar duplicados e importar solo catálogos, inventario vigente y movimientos que puedan conciliarse.

### Opción B. Reinicio operativo controlado

Conservar pacientes y documentos clínicos, iniciar inventario y caja desde un corte físico autorizado, y mantener el histórico anterior como archivo consultable protegido. No se presenta como si el histórico nunca hubiera existido.

La decisión debe indicar por escrito qué categorías se migran, cuáles quedan solo como archivo y desde qué fecha empieza la nueva operación.

## Fase 4. Ejecución controlada

- Cerrar temporalmente las escrituras en el sistema anterior.
- Crear respaldo y segunda copia verificable.
- Ejecutar la importación con identificadores de origen e idempotencia.
- Conciliar conteos, importes, existencias y pacientes.
- Documentar responsables, hora de inicio, hora de cierre y reversa.

## Condiciones para producción

- Tester aprobado por rol y flujo crítico.
- Respaldo restaurable del destino.
- Ensayo de migración con el mismo procedimiento.
- Ventana acordada con Fedra y personal informado.
- Criterios de detención ante diferencias de pacientes, dinero o inventario.
