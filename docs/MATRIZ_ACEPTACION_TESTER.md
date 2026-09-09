# Matriz de aceptación funcional · tester aislado

Candidata `0.2.0-rc.1`, commit `bf9ab03`. Este documento es el contrato de aceptación del tester: qué se prueba, con qué datos, qué debe pasar, qué evidencia queda y qué detiene la liberación.

No sustituye a `docs/HALLAZGOS.md` ni a `docs/TICKETS.md`. Un flujo que falle aquí se registra allá con su identificador antes de discutir la corrección.

## Antes de tocar nada

El tester corre `node scripts/preflight-tester.mjs` y guarda su salida. Si sale con 1, no se prueba: hay un camino hacia el Supabase de la doctora y hay que cerrarlo primero. La comprobación cubre vínculo remoto del CLI, archivos de entorno que `next dev` carga solo, `SUPABASE_ACCESS_TOKEN`, `VERCEL_TOKEN` y a dónde apuntan `SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_URL`.

Nada de lo que sigue se ejecuta contra `kxtznwgdpvbtlsedmjap`. Ese proyecto es el de la clínica.

## Datos sintéticos

Los deja `supabase/seed.sql`. Todo registro empieza con `PRUEBA` para que sea imposible confundirlo con un dato real.

Cinco cuentas, una por rol, con contraseña `Prueba-FED004A!`: `admin@`, `doctora@`, `farmacia@`, `asistente@` y `gerente@`, todas en `fedra.test`. Tres pacientes, `PRUEBA Ana`, `PRUEBA Beatriz` y `PRUEBA Carmen`. Catálogo con `PRUEBA Vitamina D3 5000UI`, `PRUEBA Metformina 850 mg`, `PRUEBA Proteína en polvo` y `PRUEBA Clonazepam 2 mg`, que es el controlado. Un proveedor, `PRUEBA Distribuidora del Valle`. Servicios `PRUEBA Consulta de control` y `PRUEBA Limpieza facial`.

Si un flujo necesita un dato que el seed no trae, se agrega al seed y no a mano. Un dato capturado a mano no se puede volver a crear en la siguiente corrida.

## Severidad y criterio de detención

**Bloqueante.** Detiene la liberación. Dinero que no cuadra, un rol que alcanza lo que no le toca, un dato de paciente que se pierde o se altera, o una operación que se duplica.

**Mayor.** No detiene la liberación al tester, sí la de producción. La operación se completa pero con un resultado equivocado, confuso o irrecuperable sin intervención.

**Menor.** Se registra y se agenda. Molesta, no engaña.

Regla: si el tester no sabe distinguir entre mayor y bloqueante, es bloqueante hasta que Dante decida.

## Evidencia

Cada flujo deja, como mínimo, captura de la pantalla final y del resultado esperado. Los que tocan dinero o expediente dejan además la consulta de comprobación contra la base del tester. Ninguna evidencia incluye datos reales de pacientes, porque no hay: todo es `PRUEBA`.

---

## A · Autenticación y roles

La tabla de autorización por ruta es `RUTAS_ROL` en `src/lib/supabase/middleware.ts` y es la referencia contra la que se prueba.

| Prefijo | Roles permitidos |
| --- | --- |
| `/inventario`, `/compras`, `/ventas`, `/caja` | admin, farmacia, gerente |
| `/cortes` | admin, doctora, gerente |
| `/pacientes`, `/agenda`, `/cobros` | admin, doctora, asistente, gerente |
| `/recetas`, `/servicios` | admin, doctora, gerente |
| `/movimientos` | admin, doctora |
| `/usuarios` | admin |

### A1 · Cada rol entra sólo a lo suyo

**Precondiciones.** Las cinco cuentas del seed.

**Pasos.** Con cada rol, visitar los doce prefijos, uno por uno, escribiendo la URL a mano y no navegando por el menú. Esconder un botón no es autorizar.

**Esperado.** Cada combinación coincide con la tabla de arriba. Un rechazo redirige y no muestra el contenido ni por un instante.

**Evidencia.** Matriz de 5 × 12 con el resultado observado.

**Severidad.** Bloqueante.

### A2 · Las rutas sin regla

**Pasos.** Con cada rol, entrar a `/dashboard` y a `/notificaciones`.

**Esperado.** Hoy las alcanza cualquier sesión: no están en `RUTAS_ROL` y el middleware es abierto por omisión. Esto es H-003 y no es un defecto nuevo. El tester lo confirma y lo anota, no lo reporta como hallazgo.

**Decisión que necesita Fedra.** Si el tablero muestra cifras de farmacia, ¿debe verlo la asistente? Sin esa respuesta la ruta no se puede clasificar.

**Severidad.** Menor como observación. Se vuelve mayor si el tablero resulta mostrar dinero a quien no le toca.

### A3 · Sesión sin perfil

**Pasos.** Con el service role del tester, crear una identidad en Auth sin fila en `usuarios` e iniciar sesión.

**Esperado.** No queda en un ciclo entre `/login` y `/dashboard`, y no alcanza ninguna operación clínica.

**Nota.** H-010 sigue abierto y FED-006 fue devuelto al autor. Es probable que falle. El valor está en documentar exactamente cómo.

**Severidad.** Bloqueante para producción, esperado como fallo en el tester.

### A4 · Alta pública

**Pasos.** Contra el Auth del tester, un `signUp` anónimo con la llave pública.

**Esperado.** Hoy se acepta y entrega rol `asistente`. Es H-013 y lo cierra FED-009, que ejecuta Dante.

**Severidad.** Bloqueante para producción. En el tester se confirma y se guarda evidencia antes y después del cambio.

---

## B · Pacientes, expediente y consultas

### B1 · Alta y edición de paciente

**Datos.** Un paciente nuevo, `PRUEBA Tester 01`.

**Pasos.** Como doctora, dar de alta con nombre, fecha de nacimiento, teléfono y dirección. Editar el teléfono.

**Esperado.** Se guarda, se relee igual, y la edad que muestra la ficha corresponde a la fecha de nacimiento en hora de Sinaloa.

**Comprobación.** La bitácora `audit_log` con `tabla = 'pacientes'` deja rastro del alta y de la edición.

**Severidad.** Bloqueante si no deja rastro. Mayor si la edad se desvía un día.

### B2 · Farmacia no ve el expediente

**Pasos.** Como farmacia, intentar `/pacientes/{id}` de `PRUEBA Ana` por URL directa, y desde la consola del navegador consultar `historias_clinicas`, `consultas` y `recetas` con la sesión abierta.

**Esperado.** Cero filas por los tres caminos. Farmacia sí lee la lista de pacientes, que es el contrato, pero no da de alta.

**Severidad.** Bloqueante.

### B3 · Historia clínica NOM-004

**Pasos.** Como doctora, capturar una historia sobre una plantilla, guardarla, reabrirla y corregir un campo.

**Esperado.** La corrección no destruye la versión anterior y queda rastro de quién y cuándo.

**Decisión que necesita Fedra.** Qué campos son obligatorios para que una nota se considere cerrada bajo NOM-004. No se inventa aquí.

**Severidad.** Bloqueante si una corrección sobrescribe sin rastro.

### B4 · Borrado de paciente

**Pasos.** Intentar eliminar `PRUEBA Carmen` desde cada rol y por API directa.

**Esperado.** Ningún rol destruye un expediente. Si existe una baja, es lógica y reversible.

**Severidad.** Bloqueante.

---

## C · InBody: carga y lectura con IA

Contrato vigente tras FED-016: modelo fijado en `gpt-4o-2024-08-06`, esquema estricto, dos pasadas obligatorias, límite de 10 MiB exactos, 45 segundos por pasada y `maxDuration` de 120 en `/pacientes/[id]` y `/recetas`.

### C1 · Lectura feliz

**Datos.** Una foto sintética de un reporte InBody. No se usa el estudio de una paciente real.

**Pasos.** Como doctora, subir la imagen desde la ficha de `PRUEBA Ana` y confirmar los valores extraídos.

**Esperado.** Los campos se llenan, la grasa visceral queda editable (el lector toma el máximo del rango y no el valor puntual, y se dejó así a propósito), y guardar crea la historia.

**Severidad.** Mayor si extrae mal. Bloqueante si guarda un valor que la doctora no confirmó.

### C2 · Archivos que deben rebotar

**Pasos.** Subir, uno por uno: un PDF, un HEIC de iPhone, un archivo de 0 bytes y uno de 10 MiB más un byte.

**Esperado.** Los cuatro se rechazan antes de emitir una sola solicitud a OpenAI. El de exactamente 10 MiB sí se acepta.

**Comprobación.** Cero llamadas salientes en los cuatro casos rechazados. Es el objetivo de costo del ticket.

**Severidad.** Mayor.

**Anotación.** El filtro de formato se apoya en `File.type`, que declara el navegador: verifica intención, no contenido. Quien de verdad rechaza el contenido es OpenAI. El límite de tamaño sí es real, porque lo mide el servidor.

### C3 · Segunda pasada fallida

**Pasos.** Con la red del tester, cortar la respuesta de la segunda pasada.

**Esperado.** La operación completa falla con mensaje claro. No devuelve la primera extracción disfrazada de éxito. Ese era el corazón de H-020.

**Severidad.** Bloqueante.

### C4 · El dato de salud que sale a un tercero

**Pasos.** Ninguno técnico. Se confirma por escrito qué se manda a OpenAI y bajo qué aviso a la paciente.

**Decisión que necesita Fedra.** H-004 sigue abierto y sin consentimiento documentado. El tester no puede cerrarlo.

**Severidad.** Bloqueante para producción.

---

## D · Recetas y membretes de media carta

### D1 · Receta que cabe

**Pasos.** Como doctora, emitir una receta de tres renglones para `PRUEBA Ana` e imprimir a PDF.

**Esperado.** Una hoja, folio único, código de barras legible, sin desbordes sobre el recetario.

**Severidad.** Mayor.

### D2 · Receta que desborda

**Pasos.** Cargar renglones hasta rebasar el área imprimible de media carta.

**Esperado.** El sistema bloquea con aviso y no emite una receta cortada. Es lo que cerró FED-015.

**Severidad.** Bloqueante. Una receta cortada es una indicación médica incompleta.

### D3 · Historia clínica larga

**Pasos.** Imprimir una historia con una sección más larga que una hoja.

**Esperado.** No se parte una sección que sí cabía, y no aparecen hojas casi vacías. El bloque mayor que una hoja sí se parte, porque no hay alternativa.

**Severidad.** Mayor.

### D4 · Edad y fecha históricas

**Pasos.** Reimprimir una receta emitida en una fecha anterior.

**Esperado.** La edad es la que tenía la paciente al emitirla, no la de hoy, y la fecha está en hora de Sinaloa. Es H-021 y H-022.

**Comprobación.** Reimprimir dos veces en días distintos da el mismo documento.

**Severidad.** Bloqueante. Es un documento clínico que cambiaría solo.

### D5 · El folio que el POS escanea

**Pasos.** Emitir receta y escanear su código en el POS.

**Esperado.** Trae los productos de la receta. El folio no se repite ni se adivina.

**Severidad.** Mayor.

---

## E · Ventas, pagos y corte

### E1 · Venta simple

**Pasos.** Como farmacia, vender 2 de `PRUEBA Vitamina D3 5000UI` en efectivo.

**Esperado.** Total correcto, ticket con folio, stock descontado del lote más próximo a caducar.

**Comprobación.** El lote consumido es el de caducidad menor y no queda stock negativo.

**Severidad.** Bloqueante.

### E2 · Pago mixto

**Pasos.** Venta con efectivo más tarjeta.

**Esperado.** La suma de los dos pagos cuadra exactamente con el total, sin centavos perdidos. El cambio se calcula sólo sobre la parte en efectivo.

**Nota.** La lógica pura ya está probada en el repositorio: 11,994 combinaciones sin un solo descuadre. Aquí se comprueba de punta a punta.

**Severidad.** Bloqueante.

### E3 · Efectivo insuficiente

**Pasos.** Capturar un efectivo recibido menor a la parte en efectivo y presionar cobrar.

**Esperado.** Se bloquea. Es H-009.

**Caso adicional.** Dejar el campo vacío. La venta sí procede, porque el campo sólo sirve para calcular cambio y su ausencia no cambia lo que se cobra. Confirmar que el ticket no imprime un cambio inventado.

**Severidad.** Bloqueante el primero, mayor el segundo.

### E4 · Doble clic y reintento

**Pasos.** Doble clic en cobrar. Después, cortar la red justo tras confirmar y reintentar.

**Esperado.** Una sola venta, un solo pago, una sola salida de inventario.

**Nota.** H-014 sigue abierto y FED-010 no ha empezado. Es probable que duplique. Documentar exactamente en qué condiciones.

**Severidad.** Bloqueante para producción.

### E5 · Cancelación

**Pasos.** Cancelar una venta cerrada.

**Esperado.** Queda rastro y el stock regresa al lote del que salió, no a uno cualquiera.

**Severidad.** Bloqueante.

### E6 · Venta cerrada que no cambia sola

**Pasos.** Desde la consola, con sesión de farmacia y de gerente, intentar `update` y `delete` sobre una venta cerrada.

**Esperado.** Ambos rechazados. Es H-007, todavía abierto: hoy las políticas son `for all`. Confirmar el comportamiento efectivo y guardar la evidencia.

**Severidad.** Bloqueante para producción.

### E7 · Corte del día

**Pasos.** Registrar ventas, hacer corte con conteo físico y provocar un descuadre a propósito.

**Esperado.** El corte usa la frontera horaria de Sinaloa, el descuadre se muestra y se guarda con responsable. Un corte cerrado no cambia después.

**Comprobación.** Una venta a las 23:50 de Sinaloa cae en el día que termina, no en el siguiente.

**Severidad.** Bloqueante.

### E8 · Cierre automático del día

**Pasos.** Disparar el cron `resumen-dia` con el `CRON_SECRET` del tester.

**Esperado.** Resume el día correcto de Sinaloa.

**Decisión que necesita Fedra.** El cron corre `0 4 * * *` UTC, que son las 21:00 en Sinaloa. Las ventas entre 21:00 y medianoche quedan fuera del resumen. Verificado numéricamente sobre `bf9ab03`. Si la farmacia opera después de las 21:00, el aviso subestima el día y hay que mover el horario.

**Severidad.** Mayor, y depende de la respuesta.

---

## F · Inventario y compras

### F1 · Entrada con lote y caducidad

**Pasos.** Registrar entrada de `PRUEBA Metformina 850 mg` con dos lotes de caducidad distinta.

**Esperado.** Ambos quedan, el stock suma, y la alerta de caducidad próxima aparece cuando corresponde.

**Severidad.** Mayor.

### F2 · No vender caducado

**Pasos.** Poner un lote con caducidad pasada e intentar venderlo.

**Esperado.** Se bloquea o se salta ese lote.

**Severidad.** Bloqueante.

### F3 · Importación de CFDI

**Pasos.** Importar un XML de compra bien formado. Después, uno con un total alterado, uno truncado y uno que no es CFDI.

**Esperado.** El primero entra. Los otros tres se rechazan con mensaje claro y sin dejar una compra a medias.

**Severidad.** Mayor.

### F4 · Libro de control COFEPRIS

**Pasos.** Vender `PRUEBA Clonazepam 2 mg` y exportar el libro.

**Esperado.** El movimiento aparece y cuadra con la venta. Los datos fiscales del ticket son los de Aldama Farmacéutica, que es una entidad distinta del consultorio.

**Severidad.** Bloqueante. Es obligación regulatoria.

### F5 · Archivos de producto

**Pasos.** Como farmacia, subir y borrar una ficha. Como doctora, leerla sin poder borrarla.

**Esperado.** Se cumple. Y si el retiro del objeto falla, la fila de `producto_archivos` no se borra, para no dejar un objeto inalcanzable.

**Severidad.** Mayor.

### F6 · El bucket clínico desde una sesión de farmacia

**Pasos.** Con la sesión de farmacia abierta, desde la consola: `list()` sobre `inbody/`, `download()` de una ruta conocida, `upload()` con sobrescritura y `remove()`.

**Esperado.** Los cuatro deben fallar. Hoy los cuatro funcionan. Es H-016 y lo cierra FED-014.

**Comprobación.** Las pruebas `it.fails` de `supabase/tests/storage.test.mts` ya dejan este hueco corriendo en cada corrida. El día que FED-014 lo cierre, esas pruebas se pondrán rojas por pasar y alguien tendrá que convertirlas en `it` normales.

**Severidad.** Bloqueante para producción. Es alteración de historia clínica bajo NOM-004, no sólo exposición.

---

## G · Notificaciones push y PWA

### G1 · Alta de suscripción

**Pasos.** En el celular, instalar la PWA, conceder permiso y suscribirse.

**Esperado.** La suscripción queda guardada y llega una notificación de prueba.

**Severidad.** Mayor.

### G2 · Suscripción caducada

**Pasos.** Limpiar los datos del navegador sin desuscribirse y mandar una prueba.

**Esperado.** El mensaje dice exactamente: `La suscripción de este dispositivo caducó. Desactiva y vuelve a activar las notificaciones.` No culpa al proveedor, y la suscripción muerta se limpia sola.

**Severidad.** Menor, pero se verifica al carácter. El texto llegó roto una vez y por eso existe el candado UTF-8 de la integración continua.

### G3 · Sin llaves VAPID

**Pasos.** Quitar las llaves VAPID del tester y disparar un cron.

**Esperado.** Reporta `configurado: false` y `sin_configuracion`. No dice que simplemente no había a quién mandar. Ya está cubierto por prueba automática.

**Severidad.** Mayor.

### G4 · Caída del proveedor

**Pasos.** Forzar respuestas 500 y 503.

**Esperado.** Ninguna suscripción se borra. Un mal día del proveedor no deja a Fedra sin dispositivos. Cubierto por prueba automática.

**Severidad.** Bloqueante. Perder los dispositivos registrados se repara a mano, dispositivo por dispositivo.

### G5 · La PWA no opera sin conexión

**Pasos.** Instalar, poner el teléfono en modo avión y abrirla.

**Esperado.** Hoy no carga: el service worker declara que no hace caché. Es H-015. El tester confirma que el fallo sea claro y que no deje una venta en estado ambiguo.

**Severidad.** Mayor.

---

## Lo que esta matriz no cubre

Nada que exija tocar `kxtznwgdpvbtlsedmjap`. La baseline efectiva de producción (FED-013) sigue sin registrarse, así que el tester no puede comparar contra lo que hoy corre en la clínica. La restauración ensayada de un respaldo tampoco entra aquí: es un procedimiento de operación, no un flujo de pantalla.

La importación del POS anterior queda fuera por completo. Su procedimiento está en `docs/MIGRACION_POS_ANTERIOR.md` y los huecos que le encontré, en `docs/AUDITORIA_MIGRACION_POS.md`.
