# Bitácora de liberaciones

Aquí se registra cada despliegue estable, fallido o revertido. No contiene secretos, respaldos ni datos clínicos; solo referencias verificables a la evidencia protegida.

## Baseline de producción pendiente

Estado: pendiente de FED-013

Todavía falta identificar el commit y el despliegue inmutable que atienden `sistema-fedra.vercel.app`. Hasta cerrar esa correspondencia no existe una versión estable recuperable registrada y no se crea ningún tag retroactivo.

## Plantilla

```text
Versión:
Tag:
Commit:
Despliegue Vercel:
Fecha y responsable:
Última migración del repositorio:
Estado efectivo de migraciones en producción:
Respaldo y restauración comprobada:
Pruebas ejecutadas:
Autorizaciones:
Inicio y fin de ventana de reversa:
Señales observadas después de desplegar:
Resultado: aprobado | revertido | detenido
```

## Despliegues al tester

El tester no es una liberación y no lleva tag. Se registra igual, porque es sobre lo que Dante y la asistente van a probar y porque hay que poder decir a qué se regresa.

```text
Versión: 0.2.0-rc.1 (sin cambio de número: FED-019 no altera el contrato de datos)
Tag: ninguno, es una candidata en el tester
Commit: c992adc, merge de FED-019 sobre codex/fedra-integration
Despliegue Vercel: https://fedra-pos-tester-e4q41oqw2-dantemvps-projects.vercel.app
Alias: https://fedra-pos-tester.vercel.app
Fecha y responsable: 30 de agosto de 2026, Claude, con autorización expresa de Dante para el tester
Última migración del repositorio: 20260824140000_fed014_retiro_clinico.sql
Migraciones aplicadas en este despliegue: ninguna. git diff --name-only 71ae88d c992adc -- supabase/ sale vacío
Estado efectivo de migraciones en el tester: sin cambio respecto a 71ae88d
Respaldo y restauración comprobada: no aplica, no hubo cambio de esquema
Pruebas ejecutadas: lint, typecheck, 64 pruebas de vitest, build y check-utf8 en local; los dos workflows verdes sobre c992adc; matriz de rutas por los cinco roles y flujos de documentos clínicos contra el tester ya desplegado
Autorizaciones: Dante, en el mensaje de trabajo del 30 de agosto de 2026. No cubre producción, ni el PR #2 hacia main, ni tags
Reversa: volver a apuntar el alias al despliegue anterior con
  vercel alias set fedra-pos-tester-dvy2dwe59-dantemvps-projects.vercel.app fedra-pos-tester.vercel.app
  que sirve 0.2.0-rc.1 en 71ae88d. En el repositorio, git revert del merge c992adc.
Resultado: aprobado para pruebas funcionales con datos sintéticos
```

Lo que este despliegue NO cubre: el ensayo del retiro clínico, que necesita la llave de servicio del tester, y la lectura del InBody por IA, que necesita una OPENAI_API_KEY exclusiva del tester y hoy no existe.
