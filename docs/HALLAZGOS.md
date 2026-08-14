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

### H-001 El token de despliegue de Vercel está quemado

Severidad: Rojo
Carril: F operación
Encontró: Dante
Estado: Abierto
Ticket: pendiente de abrir

**Evidencia.** El token se guardó en un archivo temporal y se pegó dos veces en conversaciones de chat. Está registrado en las notas del proyecto desde junio.
**Impacto.** Quien tenga ese token despliega a producción del sistema con el que la clínica factura y atiende pacientes. No requiere entrar a GitHub ni a Supabase.
**Verificación.** El token viejo deja de autenticar contra el scope `dantemvps-projects` y el despliegue solo funciona con la credencial nueva, que no vuelve a pasar por chat.

### H-002 No existe ambiente de pruebas

Severidad: Rojo
Carril: F operación
Encontró: Claude
Estado: Abierto
Ticket: pendiente de abrir

**Evidencia.** Un solo proyecto de Supabase, `kxtznwgdpvbtlsedmjap`, que es el de producción. No hay proyecto espejo ni base local declarada en el repositorio.
**Impacto.** Cualquier verificación de RLS, de las RPC de venta o de una migración se hace contra la base con los expedientes reales. Bloquea toda la Fase 1 del plan maestro.
**Verificación.** Existe un segundo proyecto con las 40 migraciones aplicadas y datos sintéticos, y las pruebas corren ahí sin tocar producción.

### H-003 El middleware no autoriza rutas

Severidad: Ámbar
Carril: B permisos
Encontró: Claude
Estado: Abierto
Ticket: pendiente de abrir

**Evidencia.** `src/middleware.ts` solo llama a `updateSession`, que refresca la sesión de Supabase. La revalidación de rol ocurre dentro de cada página y de cada server action.
**Impacto.** La protección depende de que ninguna de las 19 rutas se haya quedado sin candado. Basta una omisión para exponer un módulo completo a un rol que no debería verlo.
**Verificación.** Un inventario ruta por ruta que demuestre dónde se valida el rol, y una prueba que intente entrar a cada una con cada rol.

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
Estado: En revisión
Ticket: FED-002

**Evidencia.** No existe carpeta `.github`. Una búsqueda de archivos de prueba en el repositorio, excluyendo dependencias, no devuelve nada.
**Impacto.** La red de seguridad actual es typecheck manual, build y prueba a ojo. Una regresión en dinero o permisos llega a la clienta sin que nadie la detenga.
**Verificación.** Integración continua corriendo typecheck, lint y build en cada push, más pruebas de las funciones puras de dinero y de fecha.

---

## Cerrados

### H-000 El contexto del repositorio afirmaba cosas falsas

Severidad: Verde
Carril: F operación
Encontró: Claude
Estado: Cerrado en FED-001
Ticket: FED-001

**Evidencia.** El `CLAUDE.md` anterior declaraba Next 15 y shadcn/ui, apuntaba al commit `5dd7402` y listaba como pendientes la agenda y los permisos por rol, que llevan meses construidos. El repositorio corre Next 16.2.6 y no tiene una sola dependencia de Radix.
**Impacto.** Los dos agentes leen ese archivo como fuente de contexto. Trabajar sobre él llevaba a decisiones tomadas con datos falsos.
**Verificación.** `CLAUDE.md` y `AGENTS.md` reescritos contra el código real en FED-001, revisados por Codex.
