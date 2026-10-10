# Impresión directa de tickets

La aplicación llama a imprimir al terminar una venta confirmada. En Chrome normal aparece el diálogo. El modo `--kiosk-printing` confirma automáticamente la impresión en el destino seleccionado del perfil.

Fuente técnica: https://github.com/chromium/chromium/blob/main/chrome/common/chrome_switches.h

## Preparación en el equipo conectado a la POS-8360

1. Instalar y comprobar el controlador y el papel de 80 mm. Confirmar que Windows puede imprimir una página de prueba.
2. Ejecutar `scripts/preparar-impresion-pos.ps1`. Crea dos accesos en el escritorio y un perfil exclusivo de tickets. No modifica la impresora predeterminada de Windows ni el perfil habitual de Chrome.
3. Abrir **Fedra Tickets Configurar**, iniciar sesión y reimprimir un comprobante existente. Elegir la POS-8360, papel de 80 mm, escala 100%, sin encabezados ni pies. Verificar que salen total y QR completos.
4. Cerrar las ventanas de ese perfil y abrir **Fedra Tickets Directo**. La venta confirmada debe imprimir sin pulsar otro botón. Usar Reimprimir si falta papel; no registrar nuevamente la venta.
5. Dejar recetas e historias clínicas en el navegador habitual para elegir su impresora y papel. El modo directo confirma todas las impresiones del perfil, por eso el perfil de tickets se usa únicamente para caja.

Cambiar de impresora o papel exige volver al acceso Configurar. El navegador no confirma que el papel salió: la validación final debe hacerse en la POS-8360.

## Celular

El lector Bluetooth conectado al celular puede capturar códigos. Eso no conecta automáticamente el celular con la impresora de Windows. Para imprimir desde el celular hay que verificar la conectividad real de la impresora o instalar un puente de impresión en el equipo conectado; este cambio todavía no incorpora ese puente.
