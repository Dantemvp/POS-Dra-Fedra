# Versiones, liberaciones y reversa

## Qué identifica una versión

Una versión liberada necesita cinco datos inseparables:

1. Versión SemVer, por ejemplo `0.2.0`.
2. Tag anotado de Git, por ejemplo `v0.2.0`.
3. Commit exacto de siete o cuarenta caracteres.
4. Identificador o URL inmutable del despliegue de Vercel.
5. Última migración aplicada y evidencia del respaldo restaurable previo.

El número visible en la aplicación no demuestra por sí solo qué está en producción. La ficha de liberación reúne los cinco datos.

## Convención antes de 1.0

- `0.X.0`: conjunto revisado de funcionalidad, seguridad o cambios de operación.
- `0.X.Y`: corrección compatible que no cambia el contrato de datos.
- `0.X.0-dev.N`: trabajo preliminar que no se etiqueta ni se presenta como estable.

No se reutiliza un número. Si un despliegue falla, se registra el fallo y la siguiente corrección recibe otro número.

## Puerta de liberación

Antes de quitar el sufijo `dev`:

- La rama parte de la versión estable conocida y el árbol está limpio.
- El autor y el revisor son personas o agentes distintos.
- Lint, typecheck, pruebas, build y auditoría de dependencias de producción pasan.
- Los cambios rojos tienen autorización de Dante.
- Las migraciones se probaron fuera de producción y son compatibles con la versión anterior durante la ventana de reversa.
- La ventana mínima de reversa es de 24 horas desde el despliegue. Durante ese periodo no se elimina ni renombra nada que necesite la versión anterior.
- Existe un respaldo fechado y su restauración fue ensayada.
- `CHANGELOG.md` explica cambios, riesgos y pasos manuales.

## Ficha obligatoria de cada liberación

Copiar esta plantilla como una entrada nueva en `docs/LIBERACIONES.md`:

```text
Versión:
Tag:
Commit:
Despliegue Vercel:
Fecha y responsable:
Última migración:
Respaldo y restauración comprobada:
Pruebas ejecutadas:
Autorizaciones:
Señales observadas después de desplegar:
Resultado: aprobado | revertido | detenido
```

## Secuencia de liberación

1. Congelar el alcance y actualizar `CHANGELOG.md`.
2. Cambiar `package.json` y `package-lock.json` a la versión estable exacta.
3. Ejecutar la línea base completa y revisar el diff.
4. Crear el commit de liberación y el tag anotado correspondiente.
5. Dante autoriza y ejecuta el despliegue manual.
6. Registrar la URL inmutable de Vercel y comprobar login, pacientes, una lectura no destructiva, impresión y rutas críticas acordadas.
7. Observar errores y conciliar las operaciones afectadas antes de declarar estable.

El inventario de migraciones del commit se obtiene con `node scripts/release-metadata.mjs <tag-o-commit>` y se adjunta a la entrada. El estado efectivo de producción se consulta por separado; la lista del repositorio demuestra intención, no aplicación.

## Reversa de aplicación

Si el problema está solo en código y el esquema sigue siendo compatible:

1. Detener nuevas liberaciones y conservar evidencia del error.
2. Elegir el despliegue inmutable de la última versión estable registrada.
3. Dante vuelve a promover ese despliegue en Vercel.
4. Verificar que versión y commit visibles coincidan con la ficha elegida.
5. Ejecutar las comprobaciones de salud y conciliación antes de reabrir la operación normal.

No se usa `git reset --hard` sobre trabajo compartido. El código se corrige con un commit nuevo o `git revert`, según corresponda.

## Reversa cuando hubo migración

Volver el código no deshace la base. Las migraciones deben ser aditivas y permitir que la versión anterior siga funcionando durante la ventana acordada. Si una migración rompió datos o compatibilidad:

- Se detiene la operación afectada.
- No se ejecuta SQL inverso improvisado.
- Se aplica una migración correctiva hacia adelante cuando los datos siguen íntegros.
- Se restaura el respaldo probado solo si el plan aprobado lo exige, asumiendo y documentando la pérdida de datos posterior al respaldo.

Producción, respaldos, restauraciones, tags de liberación y promoción de Vercel requieren autorización expresa de Dante.

## Baseline pendiente

No se crea retroactivamente `v0.1.0` hasta verificar qué commit y qué despliegue exactos atienden hoy `sistema-fedra.vercel.app`. Etiquetar por suposición daría una falsa ruta de recuperación.
