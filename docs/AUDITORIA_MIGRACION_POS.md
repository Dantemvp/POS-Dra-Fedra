# Auditoría del plan de migración del POS anterior

Revisión independiente de `docs/MIGRACION_POS_ANTERIOR.md` en `bf9ab03`. Modo auditoría: no se implementa nada, no se toca ninguna fuente y no se inventa una sola regla de negocio.

## Lo que el plan ya resuelve bien

Separa las tres fuentes desde el primer párrafo, y esa separación es la que evita el accidente más caro: confundir el POS viejo con el Supabase de la clínica durante el diagnóstico. La regla de seguridad exige exportación íntegra, huella SHA-256 y restauración demostrada antes de transformar nada, que es la versión correcta de la lección de Bianca: un respaldo cuenta cuando ya lo restauraste.

La llave de origen estable de la Fase 2 es la pieza que hace la importación repetible, y está puesta antes de la ejecución y no después. Registrar los errores permanentes por separado, para que un registro malo no bloquee a los válidos, evita la migración que se detiene al 3% y hay que reiniciar entera.

La Fase 3 no decide por Fedra. Deja por escrito que la decisión es suya y qué debe contener. Eso es correcto y hay que conservarlo.

## Huecos que encontré

### M-1 · La preservación de pacientes se enuncia, no se verifica

La regla de seguridad dice que los pacientes y documentos clínicos nunca se eliminan. La Fase 4 concilia "conteos, importes, existencias y pacientes". Falta el paso que convierte esa promesa en algo comprobable: una **cuenta de control tomada antes** y vuelta a tomar después, con criterio de igualdad exacta y no aproximada.

Conciliar por conteo no basta para un expediente. Dos bases pueden tener 509 pacientes cada una y no ser las mismas 509. La comprobación tiene que ser por conjunto de identificadores de origen, no por cardinalidad.

**Propuesta.** Antes de importar, exportar la lista de llaves de origen de pacientes y su huella. Después, exigir que el conjunto importado la contenga por completo. Una diferencia de un solo paciente detiene la migración, no la promedia.

### M-2 · No hay criterio numérico de detención

"Criterios de detención ante diferencias de pacientes, dinero o inventario" aparece en las condiciones para producción, pero sin umbral. Un criterio sin número se negocia a las dos de la mañana, que es cuando se ejecutan estas ventanas.

**Decisión que necesita Fedra y Dante.** Cuál es la diferencia tolerable en dinero e inventario. Mi lectura del dominio dice que en pacientes debe ser cero y en dinero también, y que sólo el inventario admite discusión porque el conteo físico y el sistema ya difieren hoy. Pero eso lo confirma Fedra, no yo.

### M-3 · La deduplicación no dice qué gana

La Fase 1 detecta duplicados. Ninguna fase dice qué hacer con ellos. Fusionar dos expedientes de la misma persona es una operación clínica, no técnica: decide qué antecedente prevalece y cuál se archiva.

**Decisión que necesita Fedra.** Si dos registros son la misma paciente con datos distintos, ¿se fusionan, se conservan ambos vinculados, o se importan separados y ella los une después en la aplicación? Y quién firma esa fusión.

**Riesgo si no se resuelve antes.** Una deduplicación automática por nombre y fecha de nacimiento junta a dos personas distintas, y eso mete el antecedente de una en el expediente de otra. Es un daño que no se revierte con un rollback de base, porque para entonces ya se imprimió una receta.

### M-4 · El rollback está sólo del lado del origen

La Fase 4 cierra escrituras en el sistema anterior y crea respaldo. El plan no dice cómo se deshace la importación **en el destino** si la conciliación falla a la mitad.

Con las migraciones aditivas del repositorio y las relaciones `on delete cascade` que ya documenta H-007, borrar filas importadas para reintentar puede arrastrar detalle asociado. La reversa no puede ser un `delete` a mano.

**Propuesta.** Que cada fila importada lleve su marca de lote de importación, y que la reversa sea una operación por lote, ensayada en el tester antes de la ventana, con su propio conteo de control. Sin eso, el rollback real es restaurar el respaldo del destino completo, que también hay que ensayar y cronometrar: si tarda cuatro horas, la ventana con Fedra tiene que durar más que eso.

### M-5 · Falta la parada previa que hoy sí es obligatoria

Las condiciones para producción piden tester aprobado y respaldo restaurable. No mencionan que hay hallazgos rojos abiertos que tocan directamente lo que la migración va a escribir.

Concretamente: H-013 deja el alta pública abierta, H-016 deja el bucket clínico al alcance de cualquier sesión, H-014 permite duplicar una venta al reintentar y H-007 permite alterar una venta cerrada. Importar 509 expedientes a un sistema con esos cuatro caminos abiertos multiplica la superficie del problema en vez de acotarla.

El propio plan maestro ya lo dice para otro caso, en C5: los pacientes que faltan migrar llegan con el candado ya puesto, no después. Conviene que esa frase esté también aquí, porque este es el documento que alguien va a seguir el día de la ventana.

**Propuesta.** Agregar a las condiciones para producción: FED-009 y FED-014 cerrados y verificados antes de la primera importación real.

### M-6 · El histórico consultable protegido no tiene definición

La Fase 3 contempla mantener el histórico anterior "como archivo consultable protegido". No dice dónde vive, quién lo consulta, con qué permisos ni por cuánto tiempo. Un archivo clínico sin dueño ni control de acceso es exactamente el problema que H-016 describe, sólo que en otra carpeta.

**Decisión que necesita Fedra.** Quién puede consultar el histórico del POS anterior y desde dónde. Y una nota legal: si contiene datos de pacientes, le aplica la NOM-004 igual que al sistema nuevo.

### M-7 · No hay ensayo cronometrado

La Fase 2 ensaya la conversión en el tester, pero el plan no pide medir cuánto tarda. La ventana con Fedra se acuerda en la Fase 4 y sin ese número se acuerda a ojo.

**Propuesta.** El ensayo del tester reporta duración con el volumen real esperado, y la ventana se dimensiona como esa duración más el tiempo de la reversa ensayada.

## Lo que no audité

No vi el POS anterior. No sé qué motor usa, qué volumen tiene ni qué calidad traen sus datos, así que no puedo juzgar si el mapeo de la Fase 2 es suficiente. La Fase 1 existe precisamente para responder eso, y hasta que corra, cualquier estimación de esfuerzo es una suposición.

Tampoco evalué si los 509 pacientes que menciona el plan maestro en C5 son los mismos que están en el POS anterior o vienen de la hoja de cálculo. Son dos orígenes distintos y el plan sólo cubre uno.

## Resumen

El procedimiento está bien armado en su columna vertebral: separa fuentes, exige respaldo restaurable, pone la llave de idempotencia antes de ejecutar y deja la decisión con Fedra. Lo que le falta es lo que convierte un procedimiento en algo ejecutable a las dos de la mañana: números de detención, una comprobación de preservación por conjunto y no por conteo, una reversa del lado del destino, y la condición de que los cuatro hallazgos rojos que tocan datos de pacientes estén cerrados antes de la primera importación real.

Cuatro de los siete puntos necesitan una respuesta de Fedra y ninguno de ellos lo puede decidir un agente.
