# Protocolo para recibir documentos reales y anonimizarlos

Mañana llegan recetas, estudios de InBody, tickets y membretes de la operación real de Fedra, para validar formatos en el tester. Son documentos clínicos y fiscales de personas identificables. Este documento dice qué se puede hacer con ellos y qué no.

Regla que manda sobre todo lo demás: **hasta que un documento esté anonimizado y verificado, no entra al repositorio, no se sube al tester, no se pega en un chat y no se manda a ningún servicio.**

## Por qué esto no es trámite

El sistema de la doctora guarda historia clínica bajo NOM-004 y libro de control COFEPRIS. Un estudio de InBody trae nombre, edad, sexo y composición corporal: es un dato de salud de una persona identificable. Un ticket trae los datos fiscales de Aldama Farmacéutica y, si es de medicamento controlado, el rastro de qué se le vendió a quién.

Además hay un camino técnico que ya está documentado: el lector de InBody manda la imagen a OpenAI (H-004, abierto, sin consentimiento documentado). Subir un estudio real al tester y darle a "leer" lo manda a un tercero. Eso no se hace hasta que H-004 esté resuelto.

## Qué se necesita antes de recibir nada

**Autorización de Fedra, por escrito, en el pull request.** Debe decir qué documentos entrega, para qué se usan y que autoriza su uso anonimizado en un entorno de pruebas. Sin eso, los documentos se quedan donde están.

Si algún documento pertenece a una paciente identificable y no sólo a la clínica, la autorización de Fedra no basta por sí sola para el dato de la paciente. Lo que sí resuelve el caso es que **nunca entre el dato**: se anonimiza antes de cualquier uso, y lo que se conserva es el formato, no la persona.

## Cómo se reciben

Por un canal directo con Dante. No por el repositorio, no por el tester, no por un chat de grupo.

Se guardan en una carpeta **fuera del repositorio**, en la máquina de Dante:

```
C:\Users\Alex\fedra-documentos-originales\
```

Esa ruta no se versiona nunca. Conviene comprobar que el nombre de la carpeta no aparezca por accidente en ningún commit.

Cada archivo original se registra en un inventario local con: qué es, de qué fecha, quién lo entregó y qué datos identificables contiene. El inventario también vive fuera del repositorio.

## Qué se quita de cada tipo

### Receta

Se quita: nombre y apellidos de la paciente, edad, fecha de nacimiento, teléfono, dirección, folio real, código de barras y firma. El nombre de la doctora y su cédula se conservan **sólo si el objetivo es validar el membrete**; si no, también se cubren.

Se conserva: la maqueta, los márgenes, dónde cae cada bloque, cuántos renglones caben y el tamaño de letra. Eso es lo que se está validando.

### Estudio de InBody

Se quita: nombre, identificador de paciente, edad, sexo, fecha y hora de la prueba, y cualquier código del equipo que permita rastrear la medición.

Se conserva: la estructura del reporte, los rótulos de cada campo y las cifras. Si las cifras preocupan, se sustituyen por otras del mismo rango: para validar que el lector encuentra el campo, el valor da igual.

### Ticket de venta

Se quita: folio real, fecha y hora exactas, nombre de la cajera, y cualquier dato de la compradora. Si el ticket incluye medicamento controlado, se quita también el renglón del medicamento y la referencia a la receta.

Se conserva: los datos fiscales de Aldama Farmacéutica, que son de la empresa y no de una persona, el ancho del ticket y el orden de los bloques.

### Membrete

Normalmente no trae datos de pacientes. Se revisa igual antes de usarlo, porque a veces llegan escaneados encima de un documento lleno.

## Cómo se anonimiza, y cómo se comprueba

Tachar con un rectángulo negro **en un editor de imagen** y exportar de nuevo. No se usa una anotación que el visor pueda quitar, ni un resaltado sobre un PDF: eso deja el texto debajo.

Después, sobre el archivo ya anonimizado, se comprueba:

1. **Se ve.** Abrir el archivo y confirmar a ojo que no queda ningún dato.
2. **No queda texto debajo.** Si es PDF, seleccionar todo el texto y buscar el nombre. Si aparece, la tachadura fue cosmética y el archivo se descarta.
3. **No queda en los metadatos.** Las fotos de celular traen fecha, modelo y a veces ubicación. Los PDF traen autor y software. Se limpian y se vuelve a comprobar.
4. **Se renombra.** El nombre del archivo también es un dato: `receta-ana-lopez.pdf` no sirve de nada anonimizado por dentro. La convención es `receta-01.pdf`, `inbody-01.png`, `ticket-01.pdf`, `membrete-01.pdf`.

Sólo cuando los cuatro pasos están hechos, el archivo puede entrar al repositorio bajo `docs/muestras/`, o subirse al tester.

## Lo que no se hace, sin excepción

- No se sube un documento sin anonimizar al tester, ni "un momentito para ver si se ve bien".
- No se le da a leer un InBody real al extractor de IA. Eso lo manda a OpenAI y es exactamente H-004.
- No se pegan documentos en un chat, ni con Claude ni con Codex.
- No se capturan los datos de una paciente real en el tester para "que se parezca". Para eso está `PRUEBA Tester 01`.
- No se conservan los originales dentro del repositorio ni un minuto.

## Qué pasa con los originales al terminar

Se quedan en la carpeta fuera del repositorio hasta que Dante confirme que ya no hacen falta, y entonces se eliminan. La eliminación se anota en el inventario. Lo que sobrevive es la versión anonimizada.

## Qué queda pendiente de decidir

**Necesita a Fedra.** Si autoriza el uso de estos documentos para validar formatos, y si alguno corresponde a una paciente que deba ser avisada.

**Necesita a Dante.** Si las muestras anonimizadas se versionan en `docs/muestras/` o se quedan también fuera del repositorio. Versionarlas ayuda a que las pruebas de impresión sean reproducibles; no versionarlas reduce la superficie. Mi recomendación es versionarlas sólo después de que alguien distinto de quien anonimizó repita las cuatro comprobaciones, porque quien tachó ya sabe qué decía y su ojo lo completa.
