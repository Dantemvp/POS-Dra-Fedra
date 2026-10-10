# Borrador de WhatsApp para la agenda

La reunión del 8 de octubre pidió agradecer el agendamiento, recordar la cita
y solicitar confirmación. Fer quedó de enviar el mensaje definitivo y las
políticas de reagendación. Este prototipo no inventa plazos, multas ni anticipos.

## Cómo usarlo

1. Abra una cita del calendario o de Próximas citas y pulse Preparar WhatsApp.
2. Revise el nombre y teléfono. El POS precarga los datos del paciente; para
   Google se completan manualmente, sin ligar expedientes por nombre.
3. Elija Recordar y solicitar confirmación o Gracias por agendar. Puede pegar
   las políticas autorizadas y corregir el mensaje completo.
4. Abra WhatsApp en el celular o WhatsApp Web en la computadora. Revise que el
   chat corresponde al destinatario y pulse Enviar dentro de WhatsApp.

Abrir el chat no envía el mensaje, no confirma asistencia y no marca enviado.
En Gestión de citas del POS, Ya envié el recordatorio pide confirmación humana
antes de registrar ese estado. Las citas de Google siguen siendo de solo lectura.
Los borradores no se almacenan en el navegador, en la base ni en Google. Al cerrar
el editor se descartan. Cambiar nombre, tipo o políticas regenera el mensaje;
cambiar el teléfono conserva el texto editado.

## Texto inicial

Hola {nombre}.

Le recordamos su cita con la Dra. Fedra Aldama.

Le esperamos el {fecha} a las {hora} (hora de Sinaloa).

Por favor, responda a este mensaje para confirmar su asistencia.

¡Gracias!

La variante de agendamiento sustituye la segunda línea por Gracias por agendar
su cita con la Dra. Fedra Aldama. Las políticas solo aparecen si el operador
aporta su texto. Los eventos de todo el día indican horario por confirmar.

## Prueba con Fer

- Probar una cita del POS y otra de Google, en computadora y celular.
- Usar primero un teléfono propio, verificar fecha, hora y destinatario antes
  de enviar. No usar pacientes reales para mensajes de prueba.
- Comprobar que ambos botones abren el chat con el texto editado.
- Abrir y cerrar el chat sin enviar: el POS no debe marcar recordado.
- Enviar manualmente y luego marcar Ya envié el recordatorio en una cita del POS.
- Recibir el texto y políticas definitivas del consultorio antes de fijarlos
  como plantilla para todos.

No incluye envíos automáticos, WhatsApp Business API, sincronización de respuestas
ni confirmación automática de asistencia. El enlace no requiere guardar primero
el contacto en la libreta de WhatsApp.
