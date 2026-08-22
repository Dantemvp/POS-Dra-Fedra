# Hallazgos · Sistema Fedra

Tablero compartido de Claude y Codex. Todo hallazgo se escribe aquí sin importar quién lo encuentre, con el mismo formato. Ninguna memoria informal ni resumen de chat sustituye este archivo.

## Cómo se escribe un hallazgo

```markdown
### H-### Título corto

Severidad: Rojo | Ámbar | Verde
Carril: A dinero | B permisos | C pacientes | D farmacia | E integraciones | F operación
Encontró: Claude | Codex | Dante
Estado: Abierto | En revisión | Cerrado
Ticket: FED-### o ninguno

**Evidencia.** Archivo y línea, comando ejecutado o consulta. Un hallazgo sin evidencia reproducible es una sospecha.
**Impacto.** Qué pasa en la operación real de la clienta si esto se explota o se rompe.
**Verificación.** Cómo comprobar que quedó cerrado.
```

Severidad, con el mismo criterio del semáforo de `AGENTS.md`. Rojo es dinero, permisos, datos de pacientes o pérdida de información. Ámbar afecta la operación pero no destruye ni expone. Verde es calidad, orden y deuda.

Regla: quien encuentra un hallazgo no lo cierra solo. Lo cierra el revisor cuando la verificación pasa.

---

## Abiertos

Los hallazgos se conservan en el orden en que se registraron para no reescribir su historia. El identificador es estable; la posición dentro del archivo no representa prioridad ni secuencia de ejecución. La prioridad operativa vive en `docs/TICKETS.md`.

### H-001 El token de despliegue de Vercel está quemado

Severidad: Rojo
Carril: F operación
Encontró: Dante
Estado: Abierto
Ticket: FED-003

**Evidencia.** El token se guardó en un archivo temporal y se pegó dos veces en conversaciones de chat. Está registrado en las notas del proyecto desde junio.
**Impacto.** Quien tenga ese token despliega a producción del sistema con el que la clínica factura y atiende pacientes. No requiere entrar a GitHub ni a Supabase.
**Verificación.** El token viejo deja de autenticar contra el scope `dantemvps-projects` y el despliegue solo funciona con la credencial nueva, que no vuelve a pasar por chat.

### H-002 No hay ambiente de pruebas operable

Severidad: Rojo
Carril: F operación
Encontró: Claude
Estado: Abierto
Ticket: FED-004A y FED-004B

**Evidencia.** Un solo proyecto de Supabase operable, `kxtznwgdpvbtlsedmjap`, que es el de producción. El repositorio sí declara un entorno local: `supabase/config.toml` trae `project_id = "sistema-fedra"`, Postgres 17 en el puerto 54322, storage y auth habilitados, y `[db.seed]` con `sql_paths = ["./seed.sql"]`. Ese entorno nunca se ha levantado ni verificado, y `supabase/seed.sql` no existe. No existe evidencia local de un proyecto Supabase remoto separado para previews. Falta verificar si los previews están deshabilitados, fallan por falta de variables o heredan acceso a producción.
**Impacto.** Cualquier verificación de RLS, de las RPC de venta o de una migración se hace hoy contra la base con los expedientes reales. Bloquea toda la Fase 1 del plan maestro.
**Verificación.** Dos partes y se cierran por separado. FED-004A cierra cuando el entorno local levanta con las 40 migraciones aplicadas, existe `supabase/seed.sql` y una prueba corre contra esa base sin tocar producción. FED-004B cierra cuando cualquier preview funcional usa una base separada de la de la doctora.

### H-003 El control de rutas del middleware es abierto por omisión

Severidad: Ámbar
Carril: B permisos
Encontró: Claude, confirmado por Codex
Estado: Abierto
Ticket: pendiente de abrir

**Evidencia.** `src/middleware.ts` delega en `updateSession` de `src/lib/supabase/middleware.ts`. Esa función sí autoriza: exige sesión fuera de las rutas públicas, que son `/login`, `/auth`, `/api/cron`, `/sw.js` y `/manifest.webmanifest`; consulta el rol del usuario en la tabla `usuarios`; y controla doce prefijos declarados en `RUTAS_ROL`. El comentario del propio archivo declara el comportamiento por omisión: si una ruta protegida no aparece en esa tabla, queda permitida para cualquier usuario autenticado. Hoy `/dashboard` y `/notificaciones` no tienen regla. Queda por confirmar con la regla de negocio si alguna de las dos debe restringirse, así que todavía no se afirma que sean un defecto.
**Impacto.** El riesgo no es tanto la ruta que existe hoy como la que se agregue mañana: un módulo nuevo que nadie registre en `RUTAS_ROL` queda accesible para todo usuario con sesión y nada avisa. El middleware tampoco cubre las server actions, de modo que la autorización de escritura sigue dependiendo de que cada una revalide el rol por su cuenta.
**Verificación.** Un inventario ruta por ruta contra `RUTAS_ROL`, una decisión de negocio escrita para las que quedan fuera, y una prueba que intente entrar a cada ruta con cada rol. La prueba necesita FED-004A, porque hoy no hay dónde correrla sin tocar producción.

### H-004 Las fotos de InBody salen hacia OpenAI

Severidad: Ámbar
Carril: C pacientes
Encontró: Claude, corresponde a Codex verificar
Estado: Abierto
Ticket: pendiente de abrir

**Evidencia.** `src/app/(app)/pacientes/actions.ts:192` hace fetch a `https://api.openai.com/v1/chat/completions` con el modelo `gpt-4o`.
**Impacto.** Una medición corporal de una paciente identificable viaja a un tercero. No hay nada escrito que lo declare ni consentimiento documentado.
**Verificación.** Queda por escrito qué se manda, qué no se manda y bajo qué aviso a la paciente. Si se decide recortar el dato antes de enviarlo, la prueba lo demuestra.

### H-005 Dos secretos declarados que ningún archivo consume

Severidad: Ámbar
Carril: F operación
Encontró: Claude
Estado: Abierto
Ticket: pendiente de abrir

**Evidencia.** El contexto anterior del repositorio listaba `GOOGLE_API_KEY` y `FISH_AUDIO_API_KEY`. Un barrido de `process.env` sobre `src/` devuelve nueve variables y ninguna es esas dos.
**Impacto.** Un secreto cargado que nadie usa suma superficie de exposición sin dar nada a cambio.
**Verificación.** Se confirma si siguen cargadas en Vercel y se eliminan.

### H-006 Sin pruebas ni integración continua

Severidad: Ámbar
Carril: F operación
Encontró: Claude y Codex
Estado: Abierto
Ticket: FED-002, que todavía no comienza

**Evidencia.** No existe ningún workflow de integración continua. La carpeta `.github` existe desde FED-001 y solo contiene la plantilla de pull request. Una búsqueda de archivos de prueba en el repositorio, excluyendo dependencias, no devuelve nada.
**Impacto.** La red de seguridad actual es typecheck manual, build y prueba a ojo. Una regresión en dinero o permisos llega a la clienta sin que nadie la detenga.
**Verificación.** Integración continua corriendo typecheck, lint y build en cada push, más pruebas de las funciones puras de dinero y de fecha.

### H-007 Las políticas permiten modificar o borrar ventas cerradas

Severidad: Rojo
Carril: A dinero
Encontró: Claude, confirmado por Codex
Estado: Abierto
Ticket: pendiente de abrir

**Evidencia.** La política `farmacia_ventas`, creada en el bucle de `supabase/migrations/20260529000002_rls_y_roles.sql`, es `for all` sobre `ventas`. La política `gerente_ventas` de `20260624000027_rol_gerente_permisos.sql` también es `for all`. Una búsqueda de triggers sobre `ventas` en las 40 migraciones no devuelve ningún `before update` ni `before delete` que proteja una venta ya cerrada. Sí existe auditoría posterior: el trigger `audit_ventas` de esa misma migración escribe en `audit_log` en cada insert, update y delete, así que el cambio deja rastro y no debe describirse como silencioso a nivel de bitácora. Confianza alta a nivel de migraciones.
**Impacto.** Un usuario autenticado con rol farmacia o gerente puede alterar o borrar una venta cerrada llamando directo a la API de Supabase, aunque la interfaz nunca ofrezca esa operación. Las relaciones con `on delete cascade` extienden el efecto hacia partidas y pagos, de modo que un borrado se lleva el detalle de la venta con él. Rompe el invariante de que una venta cerrada no cambia por fuera del flujo de cancelación, y puede dejar inconsistencias entre el corte guardado y el detalle consultable. Falta confirmar el comportamiento efectivo.
**Verificación pendiente.** Confirmar políticas, grants y triggers efectivos en producción con una consulta de solo lectura al catálogo, cuando Dante lo autorice. La remediación se diseña y se prueba primero en el Supabase local de FED-004A, y no toca producción hasta que Dante autorice.

### H-008 Next.js está por debajo de la versión de seguridad vigente

Severidad: Rojo
Carril: F operación
Encontró: Codex
Estado: En revisión
Ticket: FED-005

**Evidencia.** `package.json` fija Next 16.2.6. El reporte de `npm audit` del 22 de agosto de 2026 marca vulnerabilidades altas en esa versión, incluido bypass de Middleware/Proxy y problemas en Server Actions. La publicación oficial de seguridad de Next recomienda actualizar la línea 16.2 a 16.2.11 o posterior.
**Impacto.** El sistema usa App Router, Middleware y Server Actions para módulos con ventas y expedientes. Una versión con bypass conocido debilita una capa de autorización y aumenta el riesgo de indisponibilidad o exposición.
**Verificación.** FED-005 actualiza Next y eslint-config-next a 16.3.2 y fija DOMPurify 3.4.14. Lint, typecheck, 12 pruebas y build pasan. `npm audit --omit=dev` reporta cero vulnerabilidades de producción. Quedan dos alertas altas en dependencias transitivas de ESLint usadas solo durante desarrollo; no se fuerzan versiones mayores incompatibles y se revisarán cuando sus paquetes padres publiquen solución.

### H-009 El POS permitía cobrar con efectivo recibido insuficiente

Severidad: Rojo
Carril: A dinero
Encontró: Codex
Estado: En revisión
Ticket: FED-002

**Evidencia.** `src/app/(app)/ventas/pos.tsx` calculaba y mostraba el faltante cuando el efectivo recibido era menor, pero `finalizar()` continuaba llamando a `cobrar()` sin bloquear la operación.
**Impacto.** Caja podía registrar una venta pagada aunque el efectivo capturado no alcanzara para cubrir la parte en efectivo, dejando un faltante operativo desde el momento del cobro.
**Verificación.** FED-002 concentra el cálculo en `src/lib/dinero.ts`, bloquea `finalizar()` cuando existe faltante y cubre cambio, faltante, pagos simples y mixtos con pruebas unitarias.

### H-010 Una sesión sin perfil puede alcanzar operaciones clínicas sensibles

Severidad: Rojo
Carril: C pacientes
Encontró: Codex
Estado: Abierto
Ticket: FED-006 y FED-014

**Evidencia.** `getUsuarioActual()` devuelve el rol `asistente` cuando la sesión autenticada no tiene una fila legible en `usuarios`. Además, `urlDocumento()` y `extraerInBody()` solo comprueban que haya una sesión. La primera genera una URL firmada de Storage y la segunda descarga el archivo y lo envía a OpenAI con una clave privada del servidor. H-016 confirma además que las políticas de `storage.objects` conceden acceso al bucket `archivos` a cualquier usuario autenticado.
**Impacto.** Una cuenta autenticada sin perfil clínico válido puede alcanzar documentos de pacientes y activar su procesamiento externo. El alta pública abierta de H-013 amplifica este camino. Un control dentro de una Server Action no protege el acceso directo a Storage.
**Verificación pendiente.** La primera implementación de FED-006, commit `170cbdc`, fue rechazada porque una sesión sin perfil o inactiva podía quedar en un ciclo de redirección entre `/login` y `/dashboard`, y porque no cerraba el acceso directo a Storage. El rediseño debe fallar cerrado sin crear ese ciclo, exigir un perfil activo y un rol clínico en cada operación de aplicación, y coordinarse con FED-014 para cerrar los bytes. El hallazgo solo se cierra con sesiones reales por rol contra el entorno local de FED-004A.

### H-011 Auth y el perfil pueden quedar en estados contradictorios

Severidad: Rojo
Carril: B permisos
Encontró: Codex
Estado: Abierto
Ticket: FED-007

**Evidencia.** `crearUsuario()` crea primero la identidad en Supabase Auth y, si falla el `upsert` en `usuarios`, devuelve el error sin reconciliar de forma demostrable ambos lados. `toggleActivo()` cambia el perfil y llama a Auth en pasos separados. La primera implementación de FED-007, commit `7a7150a`, también mostró que eliminar la identidad no elimina el perfil creado por el trigger: ninguna de las 40 migraciones crea una llave foránea desde `usuarios.auth_uid` hacia `auth.users`. Además, una actualización de perfil que afecta cero filas puede terminar sin error.
**Impacto.** El sistema puede dejar una identidad o un perfil huérfano, o mostrar un estado activo distinto del que aplica Supabase Auth. Eso vuelve ambiguo quién puede iniciar sesión y obliga a reparar cuentas manualmente.
**Verificación pendiente.** Antes del rediseño se confirma en solo lectura el estado efectivo de los perfiles heredados con `auth_uid` nulo. La nueva implementación debe comprobar filas afectadas, reconciliar identidad y perfil en cualquier fallo parcial, y reportar de forma explícita cuando la compensación también falle. FED-004A debe probar creación, activación, desactivación, fallos en cada paso y recuperación, sin tocar usuarios reales.

### H-016 Cualquier sesión autenticada lee, sustituye y borra los documentos del bucket clínico

Severidad: Rojo
Carril: C pacientes
Encontró: Claude
Estado: Abierto
Ticket: FED-014

**Evidencia.** `supabase/migrations/20260529000010_storage_policies.sql` crea cuatro políticas sobre `storage.objects`, `archivos_select`, `archivos_insert`, `archivos_update` y `archivos_delete`. Las cuatro son `to authenticated using (bucket_id = 'archivos')` y ninguna distingue rol ni ruta. El bucket es privado según `20260529000009_archivos_productos.sql:8`, así que exige una sesión y nada más. Los estudios de InBody se suben desde el navegador con la llave anónima y la sesión del usuario a `inbody/{pacienteId}/{marca-de-tiempo}-{nombre}`, en `src/app/(app)/pacientes/[id]/ImportarInBody.tsx:57` y `src/app/(app)/recetas/NuevaReceta.tsx:112`. Los archivos de producto van a `{productoId}/{marca-de-tiempo}-{nombre}` en `src/app/(app)/inventario/[id]/Archivos.tsx:41`. La tabla de metadatos `producto_archivos` sí tiene políticas por rol en esa misma migración; los bytes en Storage no tienen ninguna. Con la sesión que ya abre la aplicación, un `list()` sobre el bucket enumera todo sin adivinar rutas, y `remove()` y `upload()` con sobrescritura alcanzan cualquier objeto.

**Impacto.** El rol `farmacia`, que no tiene una sola ruta clínica en `RUTAS_ROL` del middleware, puede descargar los estudios de composición corporal de cualquier paciente, sustituirlos por otro archivo o borrarlos, desde la consola del navegador y con su propia sesión. Lo mismo alcanza a cualquier cuenta creada por el alta pública que sigue abierta en H-013. Borrar o sustituir un estudio no es solo exposición de datos, es alteración de historia clínica bajo NOM-004, y no deja rastro: los disparadores de auditoría de `20260529000002_rls_y_roles.sql` cubren `ventas`, `pagos`, `movimientos_inv`, `recetas`, `pacientes` y `productos`, todas en `public`, y `storage.objects` no está entre ellas. Un candado por rol dentro de una Server Action no cierra este camino, porque el navegador no necesita pasar por la Server Action. Contradice el invariante de `AGENTS.md`: el servidor aplica los permisos, esconder un botón no autoriza una operación.

**Verificación.** FED-014 reemplaza las cuatro políticas por un conjunto por ruta y rol, sin permisos por omisión. Se comprueba desde fuera con la llave anónima y una sesión real de cada rol, como lo haría un extraño, no leyendo las migraciones: `farmacia` no enumera ni descarga ningún objeto bajo `inbody/`, no lo borra y no lo sobrescribe; los roles clínicos sí leen los suyos; ninguna sesión, de ningún rol, borra ni sobrescribe un objeto bajo `inbody/`, según la regla que Dante confirmó el 22 de agosto de 2026; y los flujos legítimos de subir un InBody, firmar su URL y administrar archivos de producto siguen funcionando. Requiere FED-004A porque exige sesiones reales por rol contra Storage.
### H-017 Los documentos clínicos no quedan ligados a ninguna fila

Severidad: Ámbar
Carril: C pacientes
Encontró: Claude
Estado: Abierto
Ticket: FED-014

**Evidencia.** El estudio de InBody se sube a `inbody/{pacienteId}/{marca-de-tiempo}-{nombre}` desde `src/app/(app)/pacientes/[id]/ImportarInBody.tsx:57` y `src/app/(app)/recetas/NuevaReceta.tsx:112`, y esa ruta solo se usa en el momento para firmar la URL y para que `extraerInBody()` lea el archivo. Lo que se persiste después es `crearHistoria(pacienteId, inbodyTipoId, datos)` con los valores ya extraídos. La ruta nunca se guarda. La única tabla del esquema con columna `path` es `producto_archivos`, en `20260529000009_archivos_productos.sql:17`, y pertenece a productos. Ninguna fila de la base apunta a un objeto bajo `inbody/`.
**Impacto.** El documento fuente que leyó el modelo no queda ligado a la nota clínica que produjo, así que nadie puede cotejar lo que la IA interpretó contra lo que quedó en el expediente. Los objetos se acumulan sin que se puedan enumerar desde la base, y la única pista de a qué paciente pertenecen es la ruta. La regla que Dante confirmó el 22 de agosto de 2026, que una corrección entra como documento nuevo, conserva el anterior y queda vinculada a una bitácora, hoy no se puede implementar porque no existe la fila a la que vincularla. También bloquea proteger `inbody/` por metadatos, que es la estrategia que sí aplica a los archivos de producto.
**Verificación.** FED-014 crea la tabla de documentos clínicos con paciente, ruta, tipo, quién subió, cuándo y a qué documento sustituye, escribe la fila dentro del mismo flujo que sube el archivo y la incluye en los disparadores de auditoría. Se comprueba que subir un InBody deja fila, que una corrección crea una fila nueva sin borrar la anterior, y que los objetos que ya existen quedan inventariados como huérfanos antes de endurecer nada.

### H-023 Los crons reportan notificaciones enviadas aunque salgan cero

Severidad: Ámbar
Carril: E integraciones
Encontró: Codex
Estado: En revisión
Ticket: FED-017

**Evidencia.** `enviarASubs()` devolvía solamente un número y convertía en cero cuatro estados distintos: VAPID ausente o inválido, ausencia de suscripciones, proveedores rechazando todos los envíos y consultas sin datos. `api/cron/alertas` agregaba `inventario` y `agenda` al arreglo `enviados` sin revisar ese número; `resumen-dia` tampoco devolvía el resultado push.
**Impacto.** Una ejecución de cron podía responder `ok` y afirmar que procesó una categoría aunque Fedra no recibiera nada. La operación no podía distinguir un día sin dispositivos de una configuración rota o una caída del proveedor.
**Verificación.** FED-017 devuelve configuración, destinatarios, envíos, expiradas, fallidas y motivo. Los crons solo agregan una categoría a `enviados` si al menos un dispositivo recibió el push y exponen el diagnóstico estructurado. La prueba distingue éxito, parcial, sin configuración, sin destinatarios y fallo total. La entrega real todavía requiere una prueba controlada con un dispositivo de Dante o Fedra.


### H-012 La RPC de cobros confía cantidades y precios del cliente

Severidad: Rojo
Carril: A dinero
Encontró: Codex
Estado: Abierto
Ticket: FED-008

**Evidencia.** La versión vigente de `registrar_cobro()` en `20260624000027_rol_gerente_permisos.sql` suma `cantidad * precio_unit` directamente desde `p_items`. No exige cantidad positiva y vuelve a insertar ese precio en `cobro_items`. La Server Action también acepta cualquier cantidad y solo comprueba que el precio sea mayor o igual a cero. La RPC es `security definer` y se concede a `authenticated`.
**Impacto.** Un rol autorizado para cobrar puede llamar la RPC con precio cero o alterado. Con una cantidad negativa puede crear un total negativo sin pago y sin descuento de inventario. Los controles visuales del formulario no protegen una llamada directa.
**Verificación.** FED-008 debe resolver en servidor el precio de todo producto o servicio ligado, permitir conceptos libres solo bajo una regla de negocio explícita, rechazar cantidades no positivas y probar manipulación directa, stock, total y pago dentro de una transacción. No se escribe la migración hasta disponer de FED-004A; esta máquina no tiene hoy Supabase CLI ni Docker disponibles y `supabase/seed.sql` todavía no existe.

### H-013 El alta pública entrega automáticamente un rol clínico

Severidad: Rojo
Carril: B permisos
Encontró: Codex al relacionar evidencia previa
Estado: Abierto
Ticket: FED-009

**Evidencia.** La auditoría remota de solo lectura confirmó `disable_signup=false`. En las migraciones, `handle_new_user()` inserta toda cuenta posterior a la primera con rol `asistente`. Las políticas `clinica_*` permiten a asistente operar pacientes, historias clínicas, recetas y agenda. La interfaz solo ofrece iniciar sesión, pero ocultar el registro no deshabilita el endpoint de Supabase Auth.
**Impacto.** Una persona externa puede crear una cuenta directamente contra Auth y recibir permisos clínicos sin aprobación del administrador. Es un camino de acceso a expedientes, no solo una cuenta inofensiva.
**Verificación.** FED-009 deshabilita el alta pública en el proyecto remoto y demuestra que un `signUp` anónimo falla mientras `crearUsuario()` con `service_role` sigue dando de alta personal autorizado. Dante ejecuta el cambio y conserva evidencia antes/después; Codex y Claude no lo aplican por su cuenta.

### H-014 Reintentar un cobro puede duplicar venta y descuento de stock

Severidad: Rojo
Carril: A dinero
Encontró: Codex
Estado: Abierto
Ticket: FED-010

**Evidencia.** `finalizar()` llama `cobrar()` sin un identificador estable de operación. `registrar_venta()` siempre inserta una venta nueva y no existe una restricción única de idempotencia. Si el servidor confirma la transacción pero la respuesta no llega al navegador, la interfaz conserva el carrito y el siguiente intento repite la operación completa.
**Impacto.** Una conexión inestable puede producir dos cargos registrados y dos salidas de inventario para una sola venta física. Este riesgo debe resolverse antes de agregar una cola offline.
**Verificación.** FED-010 genera una clave por intento lógico, la persiste con restricción única y hace que la RPC devuelva el resultado original al repetirla. La prueba corta la respuesta después del commit y reenvía la misma solicitud; debe existir una sola venta, un solo pago y una sola salida por producto.

### H-015 La aplicación es instalable, pero no opera sin conexión

Severidad: Ámbar
Carril: F operación
Encontró: Codex
Estado: Abierto
Ticket: FED-011

**Evidencia.** Existe manifiesto PWA y `public/sw.js`, pero el service worker dice expresamente que no hace caché offline. No hay IndexedDB, outbox, detección de conectividad ni sincronización de operaciones; el registro del service worker ocurre desde la pantalla de notificaciones.
**Impacto.** Instalar el icono no vuelve híbrido al POS. Sin red no carga la operación y una caída durante una venta deja un resultado ambiguo para la cajera.
**Verificación.** FED-011 comienza con una definición aprobada de qué debe funcionar offline. Como mínimo debe mostrar estado de conexión y bloquear con claridad las operaciones no seguras. Una cola de ventas solo se abre después de FED-010 y debe probar reinicio, reintento, datos inválidos y recuperación sin duplicados.

### H-000 El contexto del repositorio afirmaba cosas falsas

Severidad: Verde
Carril: F operación
Encontró: Claude
Estado: En revisión
Ticket: FED-001

**Evidencia.** El `CLAUDE.md` anterior declaraba Next 15 y shadcn/ui, apuntaba al commit `5dd7402` y listaba como pendientes la agenda y los permisos por rol, que llevan meses construidos. El repositorio corre Next 16.2.6 y no tiene una sola dependencia de Radix.
**Impacto.** Los dos agentes leen ese archivo como fuente de contexto. Trabajar sobre él llevaba a decisiones tomadas con datos falsos.
**Verificación.** `CLAUDE.md` y `AGENTS.md` reescritos contra el código real en FED-001. Cierra cuando Codex apruebe el ticket, no antes.

---

## Cerrados

Ninguno todavía.
