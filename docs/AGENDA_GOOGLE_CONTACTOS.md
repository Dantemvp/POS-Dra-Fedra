# Datos de citas y WhatsApp

Regla confirmada por Dante el 11 de octubre de 2026: el importe que Fer escribe junto al nombre en el título de Google representa un anticipo. Los códigos pueden quedar antes o después del importe. Se conserva el título original; el saludo omite los códigos y los tratamientos reconocidos.

La lectura conserva título, fechas, notas, ubicación, invitados y propiedades adicionales. El teléfono puede venir en notas, texto del título, un enlace de WhatsApp o propiedades adicionales. Si aparecen teléfonos distintos para una persona, se pide captura; no se elige uno al azar. El organizador y los recursos no aportan teléfonos de pacientes.

Un evento con varias personas prepara un mensaje por contacto. Cada uno recibe solamente el anticipo y teléfono de su parte del título o del bloque de notas identificado con su nombre. Un teléfono compartido sin destinatario explícito no se reparte. Nada de esto liga expedientes ni registra pagos de caja.

La agenda abierta consulta Google cada 60 segundos, al recuperar foco, al volver a estar visible y al recuperar conexión. Cuando está oculta pausa las peticiones; al volver consulta de nuevo. No es una sincronización persistente en segundo plano ni un envío automático de WhatsApp.

Verificación del 11 de octubre de 2026, sin copiar datos personales: la respuesta de octubre devolvió 78 eventos, 51 títulos con importe y 5 con barra separadora. Ninguno traía descripción, ubicación, invitados, propiedades adicionales ni teléfonos en el texto. Se cotejaron dos eventos originales en Google y tampoco mostraron teléfono o notas. Se observaron respuestas HTTP 200 con intervalos de aproximadamente 60 segundos. Esto describe esa lectura, no garantiza que otros meses carezcan de teléfonos.

Desde 0.1.32, el recordatorio empieza con "Hola, buen día, [nombre]" y pide confirmar la cita con fecha y hora de Sinaloa. El motivo entra si Google lo declara con Motivo, Servicio o Tratamiento en las notas, o si el título menciona un servicio reconocido. No se traducen códigos internos a tratamientos. Si falta el motivo, el mensaje dice "tu cita" sin inventarlo. Fer aportará después el texto definitivo y las políticas; no se precargan políticas supuestas.

Pruebas sintéticas cubren variantes de Fer, notas en línea/HTML, números mexicanos e internacionales, separaciones por persona y mensajes renderizados con nombre, teléfono, motivo y anticipo propios. Sigue pendiente la revisión independiente de Claude. Por decisión de Dante, se usan solo datos de Google y captura manual del número que falte; no se busca teléfono en el padrón del POS.
