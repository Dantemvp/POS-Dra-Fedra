# Tickets · Sistema Fedra

Registro de tickets `FED-###`. El formato del contrato está en `docs/WORKFLOW_CLAUDE_CODEX.md`. Los hallazgos van en `docs/HALLAZGOS.md`.

## En curso

### FED-001 Contrato de trabajo y contexto del repositorio

Modo: Remediación · Riesgo: Verde · Carril: F operación
Autor: Claude · Revisor: Codex
Estado: primera revisión de Codex con cambios solicitados, corregidos en un segundo commit, pendiente de segunda revisión, sin subir

**Objetivo.** Dejar una sola fuente de verdad para los dos agentes antes de que cualquiera toque código del sistema.

**Qué incluye.** `AGENTS.md` con las reglas compartidas, el semáforo de riesgo y los invariantes del dominio. `CLAUDE.md` reescrito contra el código real. `docs/HALLAZGOS.md` con formato y los hallazgos registrados. `docs/WORKFLOW_CLAUDE_CODEX.md` con el flujo adaptado a una aplicación web. `docs/TICKETS.md`, este archivo. `.github/PULL_REQUEST_TEMPLATE.md`. Se suma `docs/PLAN_MAESTRO_FEDRA.md`, que quedaba fuera de control de versiones.

**Fuera de alcance.** Nada de `src/`, nada de `supabase/`, ninguna credencial, ningún despliegue. No se crean workflows de integración continua porque eso es FED-002 y es de Codex.

**Criterios de aceptación.** Ningún dato del contexto contradice el código. Los dos agentes pueden citar el mismo archivo para resolver una duda de alcance o de permisos.

**Plan de reversa.** Son archivos de documentación en una rama propia. Se descarta la rama y no queda rastro en `main`.

**Verificación hecha.** Se comprobó contra el código que el stack es Next 16.2.6 y React 19.2.4, que no hay dependencias de shadcn ni Radix, que la llave de servicio se usa solo en `src/lib/supabase/admin.ts`, que los dos crons validan `CRON_SECRET`, que el middleware exige sesión fuera de rutas públicas y controla doce prefijos por rol con `RUTAS_ROL`, y que el código consume nueve variables de entorno y ninguna es `GOOGLE_API_KEY` ni `FISH_AUDIO_API_KEY`.

## Siguientes

Esta sección conserva los contratos por identificador y por momento de registro; no se ejecuta de arriba abajo. El orden operativo vigente es: consolidar la rama canónica, FED-009, FED-004A, FED-014, rediseñar FED-006 y FED-007, FED-008, FED-010 y después FED-011. FED-013 se ejecuta en una ventana controlada con acceso a Vercel. FED-003 y FED-004B requieren autorización específica para credenciales o recursos remotos.

### FED-012 Versionado y reversa verificable

Modo: Remediación · Riesgo: Ámbar · Carril: F operación
Autor: Codex · Revisor: Claude
Estado: cerrado; implementación de Codex aprobada por Claude, integrada en la rama canónica local, sin tag ni despliegue

Mostrar versión y commit en la aplicación, validar que manifiesto, lockfile y tag coincidan, mantener un changelog y exigir una ficha por liberación. La reversa de código usa despliegues inmutables de Vercel; la reversa con migraciones requiere compatibilidad, respaldo y restauración ensayada. No crea tags, despliega ni toca producción.

### FED-013 Registrar la baseline efectiva de producción

Modo: Operación · Riesgo: Rojo · Carril: F operación
Autor: Dante · Revisores: Claude y Codex
Estado: por ejecutar con acceso autorizado a Vercel, completa FED-012

Identificar el despliegue inmutable que atiende `sistema-fedra.vercel.app`, su commit, fecha, configuración de variables de sistema y última migración efectiva. Registrar la correspondencia en `docs/LIBERACIONES.md` y ensayar que ese despliegue pueda volver a promoverse sin ejecutarlo sobre producción. Solo después se decide si corresponde crear una etiqueta histórica; nunca se etiqueta por suposición.

### FED-014 Cerrar por rol y ruta el bucket de archivos

Modo: Remediación · Riesgo: Rojo · Carril: C pacientes
Autor: Claude · Revisor: Codex · Autoriza: Dante
Estado: diseño acordado, sin SQL escrito; regla de negocio confirmada por Dante el 22 de agosto de 2026; espera FED-004A para probarse; cierra H-016 y H-017

**Objetivo.** Reemplazar las cuatro políticas planas de `storage.objects` sobre el bucket `archivos` por un conjunto que distinga ruta y rol, sin permiso por omisión, y dejar rastro de los documentos clínicos.

**Regla de negocio confirmada.** Los documentos clínicos no se borran físicamente ni se sustituyen. Una corrección entra como documento nuevo, conserva el anterior y queda vinculada a una bitácora. Cualquier excepción futura necesita una regla explícita y autorización de Dante.

**Lo que apareció al diseñar.** Ninguna fila de la base apunta a un objeto bajo `inbody/`: la ruta del estudio se usa para leerlo y se descarta, y solo se guardan los valores extraídos. Es H-017. Tiene dos consecuencias sobre este ticket. La bitácora que exige la regla no tiene a qué colgarse mientras no exista una tabla de documentos clínicos, así que esa tabla es requisito previo y no un extra. Y la protección por metadatos, que sí sirve para los archivos de producto, no se puede aplicar a `inbody/`, porque negar por omisión todo objeto sin fila dejaría fuera de golpe a los estudios que ya están cargados. Los clínicos se protegen por prefijo y rol; los de producto, por metadatos.

**Plan en dos pasos.** El segundo paso es de Codex y lo tomo tal cual: no se mueve un solo objeto de producción dentro de la primera corrección de RLS.

Paso uno, proteger sin mover nada. Inventario de solo lectura de objetos, metadatos y huérfanos, guardado como evidencia antes de tocar políticas. Tabla de documentos clínicos y escritura de su fila dentro del mismo flujo que sube el archivo, incluida en los disparadores de auditoría. Conjunto nuevo de políticas que niega por omisión: `inbody/` por prefijo y rol, rutas de producto por `exists` contra `producto_archivos.path`, y todo lo demás denegado.

Paso dos, migración independiente hacia `productos/{productoId}/...`, con autorización, reversa y evidencia propias: copiar, verificar integridad, actualizar metadatos y retirar el objeto anterior solo después de comprobarlo. Cuando termine, las políticas de producto pasan de `exists` a prefijo y dejan de depender de una tabla.

**Matriz del paso uno, sujeta a revisión de Codex.**

| Ruta | Leer | Crear | Sustituir | Borrar |
| --- | --- | --- | --- | --- |
| `inbody/` | admin, doctora, asistente, gerente | admin, doctora, asistente | nadie | nadie |
| objeto con fila en `producto_archivos` | admin, farmacia, doctora, asistente, gerente | admin, farmacia | admin, farmacia | admin, farmacia |
| cualquier otra | nadie | nadie | nadie | nadie |

La lectura de `inbody/` copia los roles que `RUTAS_ROL` ya concede a `/pacientes`. La de producto parte de `farmacia_producto_archivos`, que hoy deja leer a farmacia, admin, doctora y asistente y escribir solo a farmacia y admin. Falta reconciliar al gerente, que entró después a las rutas de inventario y nunca se agregó a esa política: si lee los bytes, también debe leer la fila, o los dos vuelven a contradecirse.

**Interacción que hay que corregir en el mismo ticket.** `eliminarArchivo()` en `src/app/(app)/inventario/actions.ts:165` retira el objeto y luego borra la fila de `producto_archivos`, sin revisar el resultado de `remove()`. Con la política del paso uno colgada de esa fila, si el retiro del objeto falla y la fila se borra igual, el objeto queda huérfano y ya nadie puede alcanzarlo ni para limpiarlo. La acción debe comprobar el resultado del retiro y no borrar la fila si falló.

**Archivos permitidos.** Migraciones nuevas bajo `supabase/migrations/`, el flujo de subida y la acción de borrado en `src/app/(app)/`, `docs/HALLAZGOS.md` y `docs/TICKETS.md`. No se reescribe ninguna migración aplicada.

**Fuera de alcance.** `package.json`, reservado a FED-002. FED-006 y FED-007, que Codex rehace aparte. El alta pública, que es FED-009. El movimiento de objetos, que es el paso dos. Cualquier ejecución contra Supabase remoto y cualquier despliegue.

**Invariantes.** Un rol sin ruta clínica en `RUTAS_ROL` no alcanza objetos clínicos por ningún camino, ni por la aplicación ni con la llave anónima desde el navegador. Ningún documento clínico se destruye ni se sobrescribe. Las migraciones son aditivas. Los flujos de la operación diaria siguen funcionando.

**Pruebas requeridas.** Todas contra FED-004A, desde fuera, con la llave anónima y una sesión real por rol, nunca leyendo los archivos de migración. Una sesión de farmacia no enumera nada bajo `inbody/` con `list()`, no descarga una ruta conocida, no la sobrescribe y no la borra. Una cuenta sin rol clínico ni de farmacia no obtiene nada en ninguna ruta. Una asistente lee un estudio y no logra borrarlo ni sustituirlo, y tampoco lo logra la doctora ni el administrador. La doctora sube un InBody, obtiene su URL firmada, extrae los datos y la subida deja fila en la tabla de documentos clínicos. Una corrección del mismo estudio crea fila nueva y conserva la anterior. Farmacia sube y borra un archivo de producto, y la doctora lo lee sin poder borrarlo. Un objeto sin fila en `producto_archivos` y fuera de `inbody/` no es alcanzable por nadie. Ningún proceso con `service_role` depende de las políticas retiradas.

**Por qué las pruebas no se escriben todavía.** Sin FED-004A no hay contra qué ejecutarlas, y una prueba que solo se salta a sí misma es la versión en pruebas del typecheck con `|| echo` que ya costó dos pantallas en blanco en Bianca. La lista de arriba es el contrato de aceptación y se implementa junto con FED-004A, donde puede fallar de verdad.

**Plan de reversa.** El conjunto anterior de políticas queda citado íntegro dentro de la migración nueva, de modo que restablecerlo sea otra migración hacia adelante y no una edición de lo ya aplicado. Si un flujo legítimo se rompe se restablece ese conjunto y H-016 vuelve a Abierto en el mismo movimiento, porque volver a las políticas planas reabre el agujero. La tabla de documentos clínicos es aditiva y no se retira en una reversa: quitarla perdería el rastro que la regla de negocio exige conservar.

### FED-015 Impresión confiable de historias y recetas

Modo: Remediación · Riesgo: Ámbar · Carril: C pacientes
Autor: Codex · Revisor: Claude
Estado: implementación en revisión; corrige H-018 y contiene H-019 con bloqueo de impresión hasta confirmar la regla de receta larga

**Objetivo.** Evitar cortes arbitrarios en historias clínicas multipágina y definir un comportamiento comprobable para recetas que no caben en media carta.

**Alcance de esta implementación.** Extraer una función pura de paginación, proteger secciones y firma al dividir la captura de historia, y cubrir documentos cortos, largos, bloques atravesados, superpuestos y mayores que una hoja. Medir el contenido de la receta en el navegador y bloquear la impresión si invade el área del código de barras, sin imponer un límite clínico inventado.

**Fuera de alcance.** Base de datos, Storage, InBody, datos reales, cambios al membrete oficial, migraciones y despliegue. La regla para una receta larga espera confirmación de Fedra o Dante.

**Criterios de aceptación.** Ningún corte normal atraviesa una sección o firma. Un bloque mayor que una hoja se divide sin bloquear el generador. El PDF conserva tamaño carta y repite el membrete. La receta se prueba con fixtures sintéticos antes de cambiar su densidad o número de hojas.

**Pruebas requeridas.** Pruebas unitarias del planificador y prueba visual pendiente en Chromium de historias sintéticas de una, dos y tres hojas. Para receta: casos de uno, cinco y diez medicamentos, indicaciones multilínea, nombre largo y código de barras legible.

**Plan de reversa.** Revertir el commit restaura los cortes fijos anteriores. No cambia datos ni archivos clínicos almacenados.

### FED-002 Línea base de integración continua y pruebas puras

Modo: Remediación · Riesgo: Ámbar · Carril: F operación
Autor: Codex · Revisor: Claude
Estado: implementado por Codex, pendiente de revisión de Claude

Integración continua con typecheck, lint y build, sin pasos que no puedan fallar. La carpeta `.github` ya existe con la plantilla de pull request, así que lo que falta es el workflow. Pruebas de las funciones puras de dinero y fecha: el parser de CFDI en `src/lib/cfdi.ts`, el cálculo de pagos mixtos y cambio, el corte de caja y la zona horaria de `src/lib/tz.ts`. Sin base de datos, porque todavía no existe ambiente de pruebas.

`package.json` queda reservado para este ticket. Ningún otro ticket lo toca mientras FED-002 esté abierto, incluido el script de typecheck que hoy no existe y que la integración continua va a necesitar.

Implementación local: workflow de CI con lint, typecheck, pruebas y build; Vitest con 12 pruebas sobre CFDI, dinero, pagos mixtos, cambio, corte de caja y zona horaria; extracción mínima de lógica pura; bloqueo de cobro cuando el efectivo recibido no completa el monto requerido. Sin base de datos ni producción.

### FED-005 Actualización de seguridad de Next.js

Modo: Remediación · Riesgo: Rojo · Carril: F operación
Autor: Codex · Revisor: Claude
Estado: implementado por Codex en rama apilada, pendiente de revisión de Claude, cierra H-008

Actualizar Next desde 16.2.6 a una versión corregida y compatible, sin saltar de línea salvo que la evidencia lo exija. Ejecutar la línea base completa de FED-002 antes y después, revisar el reporte de dependencias y separar cualquier cambio requerido por el framework. No desplegar hasta que Claude revise y Dante autorice.

Implementación local: se probó primero 16.2.11, que corrigió los avisos directos del framework pero conservó vulnerabilidades altas de PostCSS y Sharp. Se avanzó a 16.3.2, se alineó eslint-config-next y se fijó DOMPurify 3.4.14. Resultado: cero vulnerabilidades de producción, lint y typecheck limpios, 12 pruebas aprobadas y build completo. Riesgo residual: dos alertas de desarrollo dentro de ESLint. El aviso de migrar `middleware.ts` a `proxy.ts` queda fuera de este ticket.

### FED-006 Autorización explícita de documentos clínicos

Modo: Remediación · Riesgo: Rojo · Carril: C pacientes
Autor: Codex · Revisor: Claude
Estado: devuelto al autor; la implementación `170cbdc` fue rechazada y no se integra, mantiene H-010 abierto

Cerrar el rol implícito de una sesión sin perfil y exigir un perfil activo con rol clínico antes de firmar documentos o enviar un InBody a OpenAI. El flujo debe fallar cerrado sin provocar un ciclo entre `/login` y `/dashboard`. Las Server Actions cubren el camino de aplicación, pero el acceso directo a los bytes se resuelve en FED-014 y no se presenta como mitigado por este ticket. El rediseño se implementa en una rama limpia desde la base aprobada y se cierra con sesiones reales por rol en FED-004A.

### FED-007 Consistencia entre identidades y perfiles

Modo: Remediación · Riesgo: Rojo · Carril: B permisos
Autor: Codex · Revisor: Claude
Estado: devuelto al autor; la implementación `7a7150a` fue rechazada y no se integra, mantiene H-011 abierto

Evitar identidades y perfiles huérfanos, estados contradictorios y falsos éxitos al crear, activar o desactivar usuarios. El rediseño debe considerar el perfil que crea el trigger, comprobar que cada actualización afectó la fila esperada y definir compensación o reconciliación explícita si falla el segundo paso. Antes se confirma en solo lectura si existen perfiles heredados con `auth_uid` nulo. FED-004A debe ensayar éxito, fallo en cada frontera y fallo de la propia compensación, sin operar sobre cuentas reales.

### FED-008 Endurecer precios y cantidades de cobros

Modo: Remediación · Riesgo: Rojo · Carril: A dinero
Autor: por asignar · Revisor: el otro agente
Estado: por abrir después de FED-004A, cierra H-012

Rehacer `registrar_cobro()` para que los renglones ligados a catálogo obtengan su precio desde `productos.precio_venta` o `servicios.precio`, rechacen cantidades no positivas y conserven la atomicidad de cobro, pago e inventario. Antes de decidir cómo tratar conceptos y precios libres, Dante debe confirmar la regla de descuentos del consultorio. La prueba mínima intenta precio cero, precio manipulado, cantidad negativa, producto inactivo, stock insuficiente y un cobro válido. Sin cambios en producción hasta revisión cruzada y autorización.

### FED-009 Cerrar el alta pública de cuentas

Modo: Remediación · Riesgo: Rojo · Carril: B permisos
Autor: Dante · Revisores: Codex y Claude
Estado: listo para ejecutar con autorización, cierra H-013

Deshabilitar el alta pública en Supabase Auth sin eliminar el flujo administrativo de `crearUsuario()`, que usa `service_role`. Antes se guarda evidencia de la configuración actual; después se prueba que un alta anónima sea rechazada, que las sesiones existentes sigan entrando y que el administrador todavía pueda crear una empleada de prueba autorizada. El cambio real y su prueba se coordinan con la doctora para no improvisar sobre producción.

### FED-010 Idempotencia de ventas

Modo: Remediación · Riesgo: Rojo · Carril: A dinero
Autor: por asignar · Revisor: el otro agente
Estado: por abrir después de FED-004A, cierra H-014 y bloquea cualquier outbox

Asignar a cada venta una clave estable creada antes de enviar, guardarla con unicidad en la base y hacer idempotente `registrar_venta()`. El mismo intento repetido devuelve la venta original; una venta nueva usa otra clave. Probar pérdida de respuesta después del commit, doble clic, dos solicitudes concurrentes y reintento tras reiniciar el navegador.

### FED-011 Contrato híbrido y experiencia sin conexión

Modo: Diseño y remediación · Riesgo: Ámbar · Carril: F operación
Autor: Codex · Revisor: Claude
Estado: por definir después de FED-010, cierra H-015

Definir con Dante qué significa “híbrido” para Fedra: consulta de catálogo, continuidad de venta, impresión, pacientes y cortes no tienen el mismo riesgo. Primero se agrega estado de conexión y manejo claro de errores. Solo después se decide qué se guarda localmente, durante cuánto tiempo y con qué cifrado. Ningún dato clínico se cachea por accidente y ninguna venta entra a una cola sin idempotencia probada.

### FED-003 Rotación del token de despliegue

Modo: Remediación · Riesgo: Rojo · Carril: F operación
Autor: Dante · Revisor: Claude
Estado: por abrir, cierra H-001

Solo Dante ejecuta. Se rota el token de Vercel y la credencial nueva no vuelve a pasar por chat. Las llaves de Supabase, OpenAI y el par de OAuth de Google no se tocan hasta confirmar su exposición y sus dependencias, porque de la llave de servicio cuelgan los dos crons y el OAuth ya tiene a la doctora conectada.

### FED-004A Ambiente de pruebas local

Modo: Remediación · Riesgo: Rojo · Carril: F operación
Autor: Claude · Revisor: Codex
Estado: por abrir, no comienza todavía, cierra la primera mitad de H-002

Levantar el entorno local que `supabase/config.toml` ya declara, con las 40 migraciones aplicadas y datos sintéticos. Incluye el `supabase/seed.sql` que ese archivo referencia y que no existe: inventario con lotes y caducidades, pacientes falsos, servicios y un usuario por cada rol. Desbloquea las pruebas de RPC, de RLS desde fuera con la llave anónima local, y de concurrencia. Ni un solo registro real.

Archivos permitidos: `supabase/seed.sql`, los ajustes de configuración local que haga falta en `supabase/config.toml`, y documentación propia bajo `docs/`. Fuera de alcance: `package.json`, que está reservado para FED-002; `src/`; las migraciones existentes, que no se reescriben; y producción.

### FED-004B Proyecto remoto para vistas previas

Modo: Remediación · Riesgo: Rojo · Carril: F operación
Autor: Claude · Revisor: Codex · Autoriza: Dante
Estado: por abrir, no comienza todavía, cierra la segunda mitad de H-002

Segundo proyecto de Supabase en la nube para que cualquier preview funcional use una base separada de la de la doctora. Primero hay que verificar en qué estado están hoy los previews, porque no lo comprobamos. Crea un recurso y credenciales nuevas, así que no se toca sin autorización expresa de Dante. Conviene que espere a FED-003, porque configurar vistas previas con el token de despliegue todavía sin rotar es trabajar sobre una credencial que sabemos comprometida.
