# Retiro administrativo de un documento clínico

Procedimiento excepcional. No es una función de la aplicación y no debe llegar a serlo.

## Cuándo se usa, y cuándo no

Se usa cuando un documento clínico quedó donde no le tocaba y dejarlo ahí es un problema de privacidad: el InBody de una paciente cargado en el expediente de otra, una foto que además de la báscula capturó la credencial de alguien más, un documento de otra clínica que no debía entrar.

No se usa para corregir datos. Si el estudio es de la paciente correcta y lo que está mal es lo que la aplicación leyó de él, eso se arregla con una corrección: un documento nuevo que apunta al anterior con `sustituye_a`, y los dos se conservan. Tampoco se usa para hacer espacio, ni para limpiar pruebas, ni porque el archivo se vea feo.

La diferencia importa. Un retiro deja constancia de que alguien decidió sacar un documento de circulación, y esa constancia queda para siempre. Usarlo de rutina lo convierte en ruido y le quita el valor a las veces que sí importó.

## Qué hace, exactamente

El objeto no se borra. Se mueve al prefijo `cuarentena/`, que no aparece en ninguna política del bucket `archivos`. Ningún rol de la aplicación lo alcanza, ni siquiera admin: no lo descarga, no lo enumera y no puede firmar una URL hacia él. Sigue existiendo, y la llave de servicio lo sigue teniendo a la mano si un juez, la doctora o una auditoría lo piden.

La fila de `documentos_clinicos` no se toca. Queda apuntando a una ruta que ya no responde, y eso es a propósito: el rastro de que ese documento existió no se borra por haberlo retirado.

Queda una fila en `retiros_clinicos` con el motivo, quién lo autorizó, quién lo ejecutó y el sello de cuándo se movió. La leen admin y doctora. Esa fila es inmutable por disparador y no sólo por RLS, así que tampoco la reescribe la llave de servicio que la escribió: el único cambio que la base admite es poner el sello `movido_en` una vez.

## Antes de ejecutar

Tres cosas, en este orden.

Que quien autoriza lo diga por escrito, aunque sea un mensaje. El campo `responsable` va a llevar su nombre y no se puede corregir después.

Que el motivo explique el caso a alguien que lo lea en un año. La base exige veinte caracteres, que es un piso, no una meta. "Error" no es un motivo. "Se capturó el InBody de Ana en el expediente de Beatriz durante la consulta del 12 de agosto" sí lo es.

Que la ruta sea la correcta, copiada y no escrita a mano. El script comprueba que el objeto exista antes de mover nada, pero no puede saber si es el que querías.

## El comando

```bash
node scripts/retiro-clinico.mjs \
  --path "inbody/<id de la paciente>/<archivo>" \
  --motivo "..." \
  --responsable "Dra. Fedra Aldama" \
  --ejecutor tu-correo@ejemplo.mx \
  --confirmo
```

Necesita `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en el ambiente. Sin `--confirmo` no hace nada: imprime el destino, el objeto y el motivo, y se detiene para que los leas. La línea del destino dice qué base se va a modificar, y es la que hay que mirar dos veces.

## Si algo se interrumpe

El script registra el retiro **antes** de mover el objeto, y sella al final. El orden no es casual: si algo se corta a la mitad, lo que queda es un retiro sin sellar y visible, no un archivo desaparecido sin explicación.

Volver a correr el mismo comando con la misma ruta retoma ese retiro en lugar de abrir otro. Si el objeto ya no está en su ruta original pero tampoco llegó a cuarentena, el script se detiene y pide revisión a mano: en ese punto ya no puede saber qué pasó y prefiere no inventar.

Para encontrar retiros a medias:

```sql
select id, path_original, path_cuarentena, solicitado_en
from retiros_clinicos
where movido_en is null;
```

## Objetos huérfanos, que son otra cosa

Un huérfano es un objeto bajo `inbody/` sin fila en `documentos_clinicos`. No es un documento mal asignado: es uno que se subió y cuyo registro nunca se completó, o uno anterior a FED-014. Se ven en la vista `inbody_huerfanos`, que cualquier rol clínico puede consultar.

Un huérfano no se retira: se adopta. Se registra contra la paciente que dice su propia ruta, y a partir de ahí es un documento normal. Sólo si además está mal asignado entra este procedimiento, y entonces se retira aunque no tenga fila, que el script también contempla.

## Lo que falta antes de que esto toque un documento real

Está en FED-019 y es bloqueante. La autorización escrita de Fedra, la pantalla que muestre un documento retirado como retirado en vez de como archivo roto, el recorrido de los huérfanos que ya existan, y un ensayo completo del procedimiento con un documento sintético hecho por alguien distinto de quien escribió el script. Un procedimiento de emergencia que nunca se ensayó no cuenta.
