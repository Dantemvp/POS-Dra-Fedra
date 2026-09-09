# Estado operativo portátil del Sistema Fedra

Actualizado: 9 de septiembre de 2026  
Fuente: Git local, GitHub, Vercel y respuesta HTTP verificadas desde la PC de Dante.  
Propósito: permitir que una sesión nueva en PC o Mac se ubique sin depender del historial de chat.

## Regla de lectura

Este archivo es una fotografía verificable, no una verdad eterna. Al iniciar
trabajo, refresca Git y GitHub con los comandos de la última sección. Si la
evidencia actual contradice este documento, gana la evidencia y se actualiza
este archivo en el mismo PR.

No sobrecomplejizar: trabajar primero sobre el objetivo aceptado. Un hallazgo
nuevo solo interrumpe el ticket si puede comprometer dinero, inventario,
permisos, datos clínicos, despliegue o reversa. Lo demás se registra y se agenda
sin secuestrar el trabajo actual.

## Qué es el sistema

Una aplicación web/PWA con dos áreas relacionadas pero jurídicamente distintas:

- Farmacia: inventario por lotes, caducidades, compras, venta, pagos, caja,
  cancelaciones, reportes y libro de control.
- Consultorio: pacientes, agenda, historias clínicas configurables, recetas,
  InBody, documentos clínicos y notificaciones.

Stack comprobado: Next.js 16.3.2, React 19.2.4, Supabase Auth/Postgres/Storage,
Tailwind, Vitest, Vercel y web-push.

## Coordenadas canónicas

- Repositorio: `https://github.com/Dantemvp/POS-Dra-Fedra.git`
- Rama de integración: `codex/fedra-integration`
- Rama reservada para liberación: `main`, actualmente atrasada respecto a integración.
- PR de integración hacia `main`: PR #2, abierto como borrador.
- Producción: `https://sistema-fedra.vercel.app`
- Supabase producción: `kxtznwgdpvbtlsedmjap`
- Tester: `https://fedra-pos-tester.vercel.app`
- Supabase tester: `mvevriyiyuurjmwileoh`
- Proyecto Vercel tester: `fedra-pos-tester`

No copiar secretos entre equipos. Cada Mac o PC obtiene acceso por los canales
del proveedor y conserva las credenciales fuera del repositorio.

## Estado efectivo comprobado

### Tester

- Responde HTTP 200.
- Aplicación desplegada: commit `c992adc`.
- La interfaz todavía muestra `v0.2.0-rc.1`; falta emitir una RC distinta antes
  de tratarla como nueva candidata formal.
- FED-019 está desplegado: confirmación de paciente antes de subir InBody,
  vista de documentos activos o retirados y adopción idempotente de huérfanos.
- El proyecto tester está separado de producción.
- No hay `OPENAI_API_KEY` de tester registrada en la última verificación; la
  extracción de InBody con IA no se considera lista.

### Producción

- Responde HTTP 200.
- Tiene ventas y expedientes reales.
- No se ha establecido todavía una correspondencia documentada y recuperable
  entre URL, commit, despliegue inmutable y migraciones efectivas.
- No se actualiza hasta cerrar esa línea base, respaldo/restauración y
  autorización de Dante.

### Repositorio

- Punta de integración comprobada: `2660c6d`.
- PR #7 y PR #8 están fusionados en integración.
- CI de la punta tenía `verify` y `politicas` en verde.
- No hay releases formales en GitHub.
- El código nuevo de FED-019 no está en `main` ni en producción.

## Qué funciona y puede probarse en el tester

Siempre con cuentas `@fedra.test` y datos que empiecen por `PRUEBA`:

- Inicio y cierre de sesión por cinco roles.
- Pacientes, agenda e historia clínica sintética.
- Recetas y vista de impresión en media carta.
- Inventario, lotes, caducidad, compras y archivos de producto.
- Ventas simuladas, pagos mixtos, cancelación, caja, cortes y reportes.
- Restricciones por rol y separación entre farmacia y expediente.
- Instalación PWA y notificaciones cuando el navegador concede permiso.
- Carga, cancelación y consulta de documentos clínicos sintéticos.

No usar todavía pacientes, ventas, recetas, historias o InBody reales.

## Prioridad vigente

### P0. Preparar la visita y una candidata de aceptación

1. Ejecutar la matriz de aceptación con datos sintéticos y registrar evidencia.
2. Completar el ensayo de retiro y cuarentena con la llave exclusiva del tester.
3. Corregir solo defectos bloqueantes encontrados durante esa corrida.
4. Versionar y desplegar una nueva RC identificable, con reversa a `c992adc`.

### P1. Flujos clínicos que Fedra necesita validar

- FED-020: historia clínica rápida con Sí, No y No aplica, fiel al formato real
  y sin respuestas clínicas precargadas.
- FED-021: receta en media carta con medicamento, dosis, horario y aclaraciones
  agrupadas; la zona inferior queda libre para escritura manual.
- FED-022: segunda barrera del InBody que compara el nombre impreso con el
  expediente. Requiere una llave OpenAI exclusiva del tester y muestras
  anonimizadas. La persona siempre confirma; la IA nunca reasigna sola.

La calibración final de receta e historia clínica se hace con las impresoras
del consultorio. Antes de la visita sí se prueban dimensiones, desbordamientos
y generación PDF.

### P2. Bloqueos antes de producción

- Identificar la versión productiva y sus migraciones efectivas.
- Ensayar respaldo y restauración.
- Cerrar los hallazgos rojos vigentes de dinero, identidad, auditoría e
  idempotencia que `docs/HALLAZGOS.md` y `docs/TICKETS.md` mantienen abiertos.
- Confirmar la hora real de cierre para el resumen diario.
- Integrar a `main`, liberar y observar solo con autorización de Dante.

Google OAuth bidireccional y timbrado real quedan fuera de la visita inmediata.

## Decisiones de negocio ya confirmadas

- “Híbrido” significa farmacia más consultorio; no implica instalar otro POS local.
- Primero funcionalidad y seguridad, con análisis proporcional al riesgo.
- No se borra evidencia clínica para corregirla; se sustituye o se retira con rastro.
- Antes de subir un InBody se muestra y confirma la paciente seleccionada.
- La IA es una segunda barrera, nunca la autoridad final.
- Historia clínica: captura rápida y salida fiel a NOM-004-SSA3-2012 vigente.
- Receta: Fedra completa a mano la parte inferior; el sistema no invade esa zona.
- Google Calendar/OAuth puede esperar.

## Cómo trabajamos Claude y Codex

No existe un arquitecto eterno ni un auditor eterno. Para cada ticket:

- Un agente es **autor/arquitecto**: delimita, implementa y prueba.
- El otro es **auditor/revisor**: lee el diff, reproduce y busca cómo romperlo.
- Pueden intercambiar esos papeles por disponibilidad o tokens, pero nunca en
  el mismo ticket sin dejar constancia.
- El autor no aprueba su propio trabajo.
- Dante decide prioridades y autoriza producción, migraciones y datos reales.

El relevo correcto vive en Git y en el PR, no en la memoria de una conversación.
Consulta `docs/RELEVO_MULTIAGENTE.md`.

## Comandos de actualización al iniciar una sesión

```powershell
git status -sb
git remote -v
git fetch origin --prune
git log -12 --oneline --decorate --all --date-order
gh auth status
gh pr list --state open --limit 20
gh release list --limit 10
```

Después se leen `AGENTS.md`, este archivo, `docs/TICKETS.md` y solo los
hallazgos relacionados con el ticket elegido. No se reaudita todo el sistema
antes de cada tarea.
