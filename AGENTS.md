<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Sistema Fedra · reglas para Claude y Codex

Este archivo es la memoria compartida del repositorio. Claude lo lee a través de `CLAUDE.md`. Codex lo lee directo. Si algo de aquí choca con lo que un agente recuerda de otra sesión, gana este archivo.

## Qué es este sistema

POS y sistema clínico de la Dra. Fedra Yarissa Aldama Castro, en Los Mochis, Sinaloa. Junta dos negocios en una sola aplicación: la farmacia Aldama Farmacéutica y el consultorio. Son dos entidades COFEPRIS independientes.

Está en producción, con pacientes reales y ventas reales todos los días. Cualquier cambio que rompa algo lo paga la operación de la clienta el mismo día.

## Regla que manda sobre todas

Quien escribe un cambio no puede ser su único revisor.

## Regla de avance

Priorizar funcionalidad y seguridad con análisis proporcional al riesgo. Antes de proponer una solución, evaluar causa, impacto, casos límite, efectos secundarios, reversa y mantenimiento. Evitar tanto la parálisis por análisis como los parches rápidos: elegir el cambio mínimo que resuelva la causa y permita seguir avanzando.

## Reparto de carriles

Claude toma dinero, permisos, arquitectura y operación. Son los carriles A, B y F del plan maestro.
Codex toma datos clínicos, farmacia, integraciones y pruebas adversariales. Son los carriles C, D y E.

Cada ticket tiene un solo autor. El otro revisa. Si dos tareas tocan el mismo archivo, no son paralelas y se ordenan.

## Semáforo de riesgo

Rojo, un agente escribe y el otro revisa, y Dante autoriza antes de producción:
ventas, cobros, cancelaciones, cortes de caja, inventario y lotes, autenticación y roles, políticas de RLS, migraciones, datos de pacientes, respaldos.

Ámbar, cualquiera implementa con revisión cruzada:
reportes, impresión y formatos, integraciones externas, refactors que cruzan módulos, integración continua y configuración no productiva.

Verde, se permite trabajo paralelo si no comparten archivos:
pruebas, documentación, semillas de datos falsos, herramientas de diagnóstico, tipado y correcciones aisladas.

## Lo que ningún agente hace sin autorización expresa de Dante

- Push a `main` o merge de cualquier cambio rojo.
- Desplegar a producción. El deploy es manual y no ocurre solo por hacer push.
- Ejecutar migraciones contra la base de producción.
- Cambiar, rotar o leer secretos productivos.
- Tocar datos reales de pacientes o de ventas, incluso para probar.
- Aprobar su propio trabajo.

## Invariantes del dominio

- Una venta cerrada no cambia en silencio.
- Cancelaciones y devoluciones conservan rastro y regresan el stock a su lote.
- El servidor aplica los permisos. Esconder un botón no autoriza una operación.
- Un reintento o un doble clic no duplica ventas, cobros ni movimientos de inventario.
- El corte del día usa la frontera horaria de Sinaloa, que no cambia de horario, y no la del servidor.
- La historia clínica se rige por la NOM-004. El medicamento controlado se rige por el libro de control COFEPRIS.
- Las migraciones son aditivas. No se reescribe una migración ya aplicada.
- Un respaldo cuenta cuando ya se ensayó su restauración.

## Ramas y tickets

Los tickets son `FED-###` y viven en `docs/TICKETS.md`. Las ramas llevan el prefijo del autor:

```text
claude/FED-123-descripcion-corta
codex/FED-124-descripcion-corta
```

Los hallazgos de auditoría van todos a `docs/HALLAZGOS.md`, con el mismo formato, sin importar quién los encuentre.

## Modos de trabajo

Cada tarea declara su modo antes de empezar. Si el mensaje no lo dice, el agente lo confirma antes de tocar código sensible.

Auditoría, inspeccionar y reportar sin modificar nada.
Diagnóstico, reproducir y aislar la causa, sin implementar la solución.
Remediación, el cambio más pequeño que cierra el ticket, en rama propia, con prueba y plan de reversa.
Incidente, reducir daño y preservar evidencia, con producción en solo lectura hasta que Dante autorice.

## Documentos de referencia

- `docs/PLAN_MAESTRO_FEDRA.md`, el plan vigente y los seis carriles de auditoría.
- `docs/WORKFLOW_CLAUDE_CODEX.md`, el flujo de cambio completo.
- `docs/HALLAZGOS.md`, el tablero compartido de hallazgos.
- `docs/TICKETS.md`, el tablero de tickets con autor y revisor.
