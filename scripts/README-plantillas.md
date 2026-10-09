# Importar las plantillas de receta por fase

Las combinaciones de la doctora llegan como PDFs organizados en carpetas por
fase. Estos dos scripts los convierten en la migración que siembra
`plantillas_receta`. Se guardan para que la importación sea auditable y para
poder repetirla cuando Mayira mande material nuevo.

```sh
# 1. Extraer únicamente tratamiento y fase de los campos AcroForm.
#    Requiere pypdf; no copia nombre, edad ni fecha del paciente.
python scripts/plantillas-extraer-pdf.py --source "<carpeta FASES>" --output fases

# 2. Leer los recetarios y volcarlos a plantillas.json
node plantillas-parsear.mjs

# 3. Generar la migración a partir de ese JSON
node plantillas-generar-migracion.mjs
```

Los archivos entregados en octubre de 2026 guardan el contenido como campos de
formulario. Un extractor de texto normal muestra el recetario en blanco, por eso
el primer paso lee el valor canónico de los campos.

`plantillas-parsear.mjs` distingue dos formas de documento: la receta, que
lista medicamentos con asterisco y usa guiones para aclarar la aplicación de un
inyectable, y la "Nota", donde cada guion es un fármaco de rescate. Descarta
todo lo que esté arriba del renglón `NOMBRE:`, porque ahí solo hay membrete, y
en una de las hojas también los datos de una paciente.

Revisa siempre la salida antes de generar la migración. La corrida del 15 de
septiembre de 2026 dejó 54 plantillas con 147 medicamentos y dos avisos que el
consultorio debe resolver:

- La carpeta y la fase impresa no coinciden, y es sistemático. Las diez hojas
  de "FASE 2" dicen FASE 3, las diez de "FASE 3 y 4" dicen FASE 5 y las trece
  de "FASE 5" dicen FASE 1. Se guardan las dos y la pantalla lo avisa.
- "DESTETE COMBINADO WEGOBY" trae Wegovy 0.5 mg y Wegovy 0.25 mg, y solo la
  segunda tiene dosis.
