# Reemplazo de los datos operativos por el AppSheet v5

Operación autorizada por Dante: los datos operativos de producción se sustituyen
por los del archivo `Dra. Fedra v.5 (1).xlsx`. Los registros entran tal cual
vienen, sin evaluar si siguen vigentes, y se muestran marcados como información
histórica importada.

- Archivo: `K:\TODOS LOS ARCHIVOS\FEDRA\Dra. Fedra v.5 (1).xlsx`
- SHA-256: `aa4058885d94fe3ac3d6a5a62596194f3efe8ebe065df3c65450f4e077261ec0`
- Lote: `appsheet_v5_2026-09-10`
- Base: `kxtznwgdpvbtlsedmjap` (producción, sistema-fedra.vercel.app)

## Cómo se marca lo importado

Cada tabla operativa tiene dos columnas nuevas:

- `origen_datos` — el lote del que vino. Null significa capturado en este POS.
- `es_historico` — cuando es `true`, la pantalla muestra la etiqueta
  "Información histórica importada".

Las listas de pacientes, recetas, inventario y ventas traen un selector con
Todos / Actuales / Históricos, y la palabra "histórico" también funciona en la
búsqueda de texto.

## Qué no se toca

Ni el vaciado ni la importación tocan estas tablas: `usuarios`,
`tipos_historia`, `campos_historia`, `audit_log`, `push_subscriptions`,
`google_calendar_conexion`. `auth.users` queda intacta: las contraseñas del
sistema viejo no se importan ni se muestran, y nadie cambia de cuenta.

Tampoco se tocan migraciones, funciones, políticas RLS ni el código.

## Orden de los pasos

Todo vive en `scripts/migracion/`. El token de Supabase se lee de
`SUPABASE_ACCESS_TOKEN` o de `C:\Users\Alex\fedra-access-token.txt`, y nunca se
imprime.

```
python respaldar.py                                  # respaldo completo
python importar.py                                   # ensayo, no escribe
python vaciar.py  --respaldo <carpeta>               # ensayo, no borra
python vaciar.py  --respaldo <carpeta> --ejecutar    # vacía (pide confirmación)
python importar.py --ejecutar                        # importa
```

El respaldo se guarda en `C:\Users\Alex\ConsultoraDV\respaldos-fedra\prod-<fecha>`
con un archivo por tabla, `restaurar.sql`, la estructura, y un `MANIFIESTO.txt`
con el conteo de cada tabla y el SHA-256 de cada archivo.

`vaciar.py` se niega a correr si no encuentra un respaldo con manifiesto, y pide
que se escriba la frase de confirmación completa.

## Cómo volver atrás

**Los datos.** Correr `vaciar.py` de nuevo y después `restaurar.sql` del
respaldo. Los conteos del manifiesto dicen en qué estado debe quedar cada tabla.

**El esquema.** La migración `20260910000043_origen_historico.sql` trae su
reversa al final del archivo, comentada: quita las columnas y la tabla que
agregó. Deshacerla no borra datos operativos, sólo la marca de procedencia.

**El despliegue.** Volver al tag anterior en Vercel. El código de esta operación
sólo agrega la etiqueta y el filtro; una versión anterior sigue leyendo la base
sin problema, simplemente no distingue lo importado.

## Decisiones que conviene revisar

**Qué se mapeó a dónde.** El destino de cada hoja ya venía decidido en la
migración `20260606000019`: `Historial` son cobros, `DetalleHistorial` sus
renglones, `Pagos` los pagos de esos cobros y `Aranceles` el catálogo de
servicios. La historia clínica de cada paciente se arma con el formulario que el
sistema viejo guardaba en la hoja `Pacientes`.

**Las respuestas se casan por etiqueta.** Al importar una historia, cada columna
del Excel se busca en `campos_historia` por su etiqueta. Lo que casa cae en su
sección; lo que no, se guarda con su etiqueta original y la pantalla lo muestra
bajo "Datos". Nada se pierde por no casar.

**Un usuario que no es una persona.** Las ventas y los cortes exigen un usuario
y no queremos atribuirle a nadie movimientos que no capturó. Se crea
`importacion-historica@sistema.local`, inactivo y sin cuenta en `auth`, así que
nadie puede entrar con él.

**Catálogo reconstruido.** Quince existencias apuntan a productos que no vienen
en el catálogo del archivo. Como cada una declara el nombre del producto, la
ficha se levanta con ese nombre: no es adivinar un vínculo, el nombre es el
identificador. Cada caso queda anotado en `importacion_pendientes`.

**Las ventas importadas no entran al corte.** La consulta que alimenta el corte
del día filtra `es_historico = false`, y las históricas se consultan aparte. En
la lista de caja el selector arranca en "sólo ventas de hoy". Una venta
importada tampoco se puede cancelar: devolvería al inventario de hoy mercancía
que se vendió en el sistema anterior.

**La cantidad recetada.** El sistema viejo guardaba cuántas piezas se recetaban
y este esquema no tenía dónde ponerlo. Se agregó `receta_items.cantidad`. La
receta impresa no cambió: ese código es delicado y esta operación no lo toca.
Falta decidir si debe mostrarse.

## Lo que no pudo conservar su relación

Nada se descarta en silencio. Cada renglón que no pudo entrar a su tabla se
guarda completo, en crudo, en `importacion_pendientes`, con la hoja de la que
vino y el motivo. Ahí van también las hojas del sistema viejo que este POS no
tiene dónde guardar: consentimientos, InBody, sesiones de terapia, el catálogo
de medicamentos y las respuestas de formulario.

La hoja `Doctores` no se importa. Trae doce contraseñas en claro y meterlas a la
base sería justo lo que la autorización prohíbe.
