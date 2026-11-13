# Recetas, historia y formulario remoto

Este lote cubre siete peticiones del consultorio: abreviar envases en recetas, aclarar duración de fase, permitir antecedentes negados, usar etiquetas claras, mostrar el detalle de medicamentos, recibir respuestas remotas como borrador y adjuntar identificaciones privadas.

La fase con duración y el detalle condicional ya existían. Se aclararon sus controles y se comprobaron con la plantilla real de las migraciones. Los identificadores de preguntas y las respuestas históricas se conservan; no hay migración clínica.

## Comportamiento

- La abreviación conserva sustancia, concentración, forma y vínculo con inventario. Las recetas guardadas no cambian al abrirlas; el editor ofrece una acción expresa para acortar nombres.
- Negado excluye familiares y viceversa. Una respuesta vacía sigue pendiente. La validación del servidor rechaza contradicciones y conserva texto histórico sin cambios.
- La edición permite completar preguntas ausentes y conserva detalles antiguos aunque falte el Sí/No incorporado después. Una respuesta No explícita cierra su detalle.
- `/formulario/historia` muestra únicamente preguntas de la plantilla activa, sin pacientes ni UUID internos. El paciente puede responder parcialmente, descargar y recuperar un archivo, compartirlo o copiar el texto. La asistente confirma identidad y revisa el borrador antes de guardarlo. No hay recepción automática ni escritura pública a historias.
- Los archivos de identificación quedan en un bucket propio privado. Las acciones validan sesión, rol clínico, paciente, tamaño, ruta y firma del archivo. Admiten JPG, PNG, WebP y PDF hasta 4 MiB; generan descargas de 60 segundos. No se añade borrado ni reemplazo de documentos.

## Verificación

`npm test`: 185 pruebas aprobadas; la base anterior tenía 171. `npm run lint` y TypeScript pasaron. El build con `npm run build -- --webpack` pasó. Turbopack no admite el junction local de dependencias de este worktree; no se modificó el lockfile para resolverlo.

La revisión independiente encontró y permitió corregir pérdida histórica al editar, sexo discrepante en importación, vínculo de inventario ambiguo y reemplazo de borrador conservado. La prueba de navegador usó datos ficticios a 390 y 1440 px, sin Supabase ni impresión reales.

Demo aislada: `node tests/manual/panel-demo-server.mjs --actualizacion`. Permite las vistas `?vista=formulario`, `?vista=paciente` y `?vista=receta`. Usa el CSS del último build y sustituye las acciones por registros en memoria.

## Liberación pendiente

El código no se ha publicado. La migración `20261113000049_identificaciones_pacientes.sql` está preparada y probada con PGlite, sin aplicarse a la base remota. Crear el bucket y sus políticas requiere autorización expresa, igual que el despliegue. El PR #52 permanece separado.

Antes de publicar: verificar configuración de servidor Supabase para leer la plantilla pública; autorizar y aplicar la migración del bucket; comprobar cámara, archivos y devolución por WhatsApp en el teléfono del consultorio. La validación de firmas no sustituye antivirus ni análisis completo de PDF. El avance remoto reside en la pestaña: para recuperarlo tras cerrar, el paciente debe descargar el archivo.

Para revertir, restaurar el despliegue anterior y mantener el bucket privado con sus documentos. No borrar archivos ni historias como parte del rollback.
