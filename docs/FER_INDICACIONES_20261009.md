# Indicaciones de Fer, 9 de octubre de 2026

Autor: Codex. Claude aprobó el código `ca19b61` en [la revisión del PR #39](https://github.com/Dantemvp/POS-Dra-Fedra/pull/39#issuecomment-6099457679).
Base: main `3a64426`, producción 0.1.23. Este documento no acredita un despliegue.

## Cambios

1. En el expediente, **Editar datos del paciente** permite corregir nombre, apellidos y WhatsApp. Guarda sobre el mismo ID; no crea otro paciente ni cambia el origen histórico o sus vínculos con recetas e InBody. Admin, doctora, asistente y gerente pueden usarlo según los permisos existentes. La acción verifica la sesión y el rol real en el servidor y detecta cambios concurrentes. Farmacia no puede usarla. Conserva la auditoría existente de actualizaciones de pacientes; no agrega otra bitácora.
2. La migración `20261009000048_hc_inhibidores_detalle.sql` agrega “¿Cuáles inhibidores del apetito ha consumido?” después de la pregunta existente. La respuesta Sí abre el detalle; No lo cierra y el formulario lo excluye del guardado. El detalle es opcional. No reescribe respuestas anteriores ni modifica las plantillas de fases. Si falta la pregunta o hay una configuración incompatible, aborta. Un reintento correcto no duplica campos.
3. Agenda incorpora un panel plegable de Google Calendar, separado de las citas del POS. Consulta el calendario principal por mes, en hora de Sinaloa, al abrir el panel o pulsar Actualizar. No hay tarea periódica ni sincronización de citas hacia la base. No solicita acceso a Gmail, ni crea, modifica o elimina eventos en Google.

## Activación de Google

El POS usa las variables existentes `GOOGLE_OAUTH_CLIENT_ID` y `GOOGLE_OAUTH_CLIENT_SECRET`, solo en servidor. No usa la contraseña del correo. El refresh token queda cifrado en la tabla existente `google_calendar_conexion`, sin conservar el access token. Cambiar el secreto OAuth requiere reconectar.

Antes de activar:

- Confirmar que la tabla de la migración 040 existe, mantiene RLS y no tiene políticas que expongan sus tokens a usuarios normales.
- En el cliente OAuth de Google Cloud, habilitar Calendar API y registrar exactamente `https://sistema-fedra.vercel.app/api/google-calendario/callback` como URI de redirección autorizada.
- Si la aplicación OAuth está en modo de pruebas, agregar la cuenta de la doctora como usuario de prueba. Google puede caducar la autorización de prueba; no confundirla con una conexión permanente.
- Después de publicar, entrar al POS como admin o doctora, abrir Agenda, desplegar Google y pulsar Conectar. Autorizar la cuenta indicada por el consultorio. Asistente y gerente pueden consultar, pero no conectar otra cuenta.
- Dante confirmó la cuenta fijada en el código. No usar la cuenta anterior. Esta entrega consulta su calendario principal y no selecciona calendarios secundarios.
- Si existe un permiso anterior de la misma aplicación, revocarlo en Google antes del nuevo consentimiento, no después. Una revocación posterior también puede invalidar la conexión nueva.

El servidor rechaza otra cuenta, permisos de escritura, acceso a correo, tokens antiguos sin cifrar y estados OAuth ajenos o vencidos. Solicita consentimiento nuevo con PKCE. Los errores se muestran como errores, no como ausencia de citas. El navegador y el service worker no guardan respuestas de esta API en caché. Google sigue siendo el lugar para editar la agenda. Para retirar el acceso, revocarlo desde los permisos de la cuenta de Google.

Referencias: [OAuth para servidor](https://developers.google.com/identity/protocols/oauth2/web-server), [consulta de eventos](https://developers.google.com/calendar/api/v3/reference/events/list).

## Publicación y reversa

1. Claude revisa esta rama, sin mezclar el PR #37.
2. Tomar respaldo fresco de las definiciones de `campos_historia`. Revisar en producción la pregunta de inhibidores y que las columnas `depende_de` y `depende_valor` existan. Aplicar **solo 048** tras verificar el historial remoto. No ejecutar `supabase db push` indiscriminado: 046 y 047 pertenecen a otro trabajo.
3. Integrar y preparar la siguiente versión. Desplegar la app después de la migración y comprobar los pasos de aceptación.
4. La app anterior admite el campo aditivo: volver al despliegue previo no exige borrar historias. No eliminar el campo de la base una vez que tenga respuestas. Si se necesita revertir su visibilidad, revisar primero las referencias y conservar las respuestas.

## Pruebas con Fer

- Corregir nombre y WhatsApp de un paciente de prueba; recargar y comprobar el enlace de WhatsApp y que recetas e InBody sigan en el mismo expediente.
- Cancelar una edición y confirmar que nada se guardó. Abrir el mismo paciente en dos pestañas; la segunda debe pedir recargar si la primera ya cambió sus datos.
- En la historia que contiene la pregunta, marcar Sí, escribir un detalle ficticio, guardar y revisar su vista imprimible. En otra captura marcar Sí, escribir y cambiar a No: no debe conservar ese detalle.
- Consultar Google con la sesión de asistente después de autorizarlo como doctora/admin. Cambiar un evento ficticio en Google y pulsar Actualizar en el POS. Confirmar fecha, hora y eventos de todo el día; comprobar que no aparece otra cita dentro del calendario propio del POS.

Las pruebas automatizadas usan datos ficticios y conexiones externas simuladas, excepto las pruebas SQL de 048 que ejecutan la migración en PostgreSQL/PGlite local. No acreditan consentimiento real de Google, RLS efectivo remoto ni impresión física. Los videos y datos de pacientes no entran al repositorio.

## Operación del 10 de octubre

Dante autorizó respaldo, migración y publicación después de la revisión independiente. Confirmó la cuenta de Google que fija el código; esa condición está resuelta.

- Respaldo local de 98 definiciones, con manifiesto SHA-256 y SQL de restauración; sin pacientes, respuestas ni secretos. Se comprobó su restauración y reintento en PostgreSQL/PGlite antes de tocar la base.
- 048 aplicada y registrada en el historial remoto dentro de la misma transacción, con bloqueo breve y comprobación de que las definiciones no habían cambiado desde el respaldo. Quedaron 99 campos. Se cotejaron los originales: solo cambiaron los órdenes posteriores de General y apareció el detalle en orden 5. No se aplicaron 046/047 ni se creó una tabla de respaldo productiva.
- La tabla existente de conexión con Google mantiene RLS y cero políticas de acceso directo, comprobado en producción sin leer tokens.
- Versión de la entrega: 0.1.24. El código funcional conserva el SHA revisado; el commit de preparación solo cambia versión, changelog y este registro. El resultado del despliegue se registrará en el PR al terminar, no se presume aquí.

Para reversa de la aplicación se conserva el despliegue previo de 0.1.23. El SQL del respaldo restaura definiciones originales por ID, sin borrar campos aditivos ni respuestas; no ejecutarlo automáticamente después de nuevas capturas.
