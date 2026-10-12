# Reversa compatible de 0.1.34

Base: 303e77c4c8620f15454305c3270f060ed605e4e0, interfaz y versión 0.1.33.

Esta rama conserva desde el SHA aprobado 624019d el lector de alcance, CSV, comprobante térmico y detalle de cortes. No escribe migraciones ni datos. La caja anterior no recupera como propio combinado un corte nuevo de Consultorio: si el último corte es clínico, la recuperación devuelve vacío; administración puede abrirlo desde el historial.

Si ya se guardó un corte con `__area_corte`, no volver al despliegue 0.1.33 original. Desplegar esta rama compatible tras verificar su commit y los contratos actuales. No fusionarla a main como continuación normal, ni ejecutar SQL, `db push`, borrados o cambios de permisos.

Las nuevas pruebas usan datos inventados y reproducen los dos marcadores, ticket, CSV, recuperación y exclusión de Farmacia en el detalle clínico. No acreditan impresión física ni una restauración de datos. El código mantiene el comportamiento de escritura anterior a 0.1.34; esta es una reversa de aplicación, no de base de datos.

Verificación local: 145/145 pruebas Node, lint, tipos y build pasan sin `.env`, con variables ficticias de Supabase para compilar. La primera instalación aislada omitió un archivo de Next por un error de extracción de Windows; se repuso desde la instalación existente de la misma versión, con contenido idéntico salvo saltos de línea. No se cambió el lockfile ni se modifica ese paquete al publicar: Vercel instala las dependencias declaradas desde cero.
