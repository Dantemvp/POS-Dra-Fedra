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
Ticket: FED-003

**Evidencia.** El token se guardó en un archivo temporal y se pegó dos veces en conversaciones de chat. Está registrado en las notas del proyecto desde junio.
**Impacto.** Quien tenga ese token despliega a producción del sistema con el que la clínica factura y atiende pacientes. No requiere entrar a GitHub ni a Supabase.
**Verificación.** El token viejo deja de autenticar contra el scope `dantemvps-projects` y el despliegue solo funciona con la credencial nueva, que no vuelve a pasar por chat.

### H-002 No hay ambiente de pruebas operable

Severidad: Rojo
Carril: F operación
Encontró: Claude
Estado: Abierto
Ticket: FED-004A y FED-004B

**Evidencia.** Un solo proyecto de Supabase operable, `kxtznwgdpvbtlsedmjap`, que es el de producción. El repositorio sí declara un entorno local: `supabase/config.toml` trae `project_id = "sistema-fedra"`, Postgres 17 en el puerto 54322, storage y auth habilitados, y `[db.seed]` con `sql_paths = ["./seed.sql"]`. Ese entorno nunca se ha levantado ni verificado, y `supabase/seed.sql` no existe. Tampoco existe un proyecto remoto separado que puedan usar las vistas previas de Vercel.
**Impacto.** Cualquier verificación de RLS, de las RPC de venta o de una migración se hace hoy contra la base con los expedientes reales. Las vistas previas de Vercel apuntan a producción. Bloquea toda la Fase 1 del plan maestro.
**Verificación.** Dos partes y se cierran por separado. FED-004A cierra cuando el entorno local levanta con las 40 migraciones aplicadas, existe `supabase/seed.sql` y una prueba corre contra esa base sin tocar producción. FED-004B cierra cuando las vistas previas apuntan a un proyecto remoto que no es el de la doctora.

### H-003 El control de rutas del middleware es abierto por omisión

Severidad: Ámbar
Carril: B permisos
Encontró: Claude, confirmado por Codex
Estado: Abierto
Ticket: pendiente de abrir

**Evidencia.** `src/middleware.ts` delega en `updateSession` de `src/lib/supabase/middleware.ts`. Esa función sí autoriza: exige sesión fuera de las rutas públicas, que son `/login`, `/auth`, `/api/cron`, `/sw.js` y `/manifest.webmanifest`; consulta el rol del usuario en la tabla `usuarios`; y controla doce prefijos declarados en `RUTAS_ROL`. El comentario del propio archivo declara el comportamiento por omisión: si una ruta protegida no aparece en esa tabla, queda permitida para cualquier usuario autenticado. Hoy `/dashboard` y `/notificaciones` no tienen regla. Queda por confirmar con la regla de negocio si alguna de las dos debe restringirse, así que todavía no se afirma que sean un defecto.
**Impacto.** El riesgo no es tanto la ruta que existe hoy como la que se agregue mañana: un módulo nuevo que nadie registre en `RUTAS_ROL` queda accesible para todo usuario con sesión y nada avisa. El middleware tampoco cubre las server actions, de modo que la autorización de escritura sigue dependiendo de que cada una revalide el rol por su cuenta.
**Verificación.** Un inventario ruta por ruta contra `RUTAS_ROL`, una decisión de negocio escrita para las que quedan fuera, y una prueba que intente entrar a cada ruta con cada rol. La prueba necesita FED-004A, porque hoy no hay dónde correrla sin tocar producción.

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
Estado: Abierto
Ticket: FED-002, que todavía no comienza

**Evidencia.** No existe ningún workflow de integración continua. La carpeta `.github` existe desde FED-001 y solo contiene la plantilla de pull request. Una búsqueda de archivos de prueba en el repositorio, excluyendo dependencias, no devuelve nada.
**Impacto.** La red de seguridad actual es typecheck manual, build y prueba a ojo. Una regresión en dinero o permisos llega a la clienta sin que nadie la detenga.
**Verificación.** Integración continua corriendo typecheck, lint y build en cada push, más pruebas de las funciones puras de dinero y de fecha.

### H-007 Las políticas permiten modificar o borrar ventas cerradas

Severidad: Rojo
Carril: A dinero
Encontró: Claude, confirmado por Codex
Estado: Abierto
Ticket: pendiente de abrir

**Evidencia.** La política `farmacia_ventas`, creada en el bucle de `supabase/migrations/20260529000002_rls_y_roles.sql`, es `for all` sobre `ventas`. La política `gerente_ventas` de `20260624000027_rol_gerente_permisos.sql` también es `for all`. Una búsqueda de triggers sobre `ventas` en las 40 migraciones no devuelve ningún `before update` ni `before delete` que proteja una venta ya cerrada. Sí existe auditoría posterior: el trigger `audit_ventas` de esa misma migración escribe en `audit_log` en cada insert, update y delete, así que el cambio deja rastro y no debe describirse como silencioso a nivel de bitácora. Confianza alta a nivel de migraciones.
**Impacto.** Un usuario autenticado con rol farmacia o gerente puede alterar o borrar una venta cerrada llamando directo a la API de Supabase, aunque la interfaz nunca ofrezca esa operación. Las relaciones con `on delete cascade` extienden el efecto hacia partidas y pagos, de modo que un borrado se lleva el detalle de la venta con él. Rompe el invariante de que una venta cerrada no cambia por fuera del flujo de cancelación, y el corte del día que la incluía deja de cuadrar.
**Verificación pendiente.** Confirmar políticas, grants y triggers efectivos en producción con una consulta de solo lectura al catálogo, cuando Dante lo autorice. La remediación se diseña y se prueba primero en el Supabase local de FED-004A, y no toca producción hasta que Dante autorice.

### H-000 El contexto del repositorio afirmaba cosas falsas

Severidad: Verde
Carril: F operación
Encontró: Claude
Estado: En revisión
Ticket: FED-001

**Evidencia.** El `CLAUDE.md` anterior declaraba Next 15 y shadcn/ui, apuntaba al commit `5dd7402` y listaba como pendientes la agenda y los permisos por rol, que llevan meses construidos. El repositorio corre Next 16.2.6 y no tiene una sola dependencia de Radix.
**Impacto.** Los dos agentes leen ese archivo como fuente de contexto. Trabajar sobre él llevaba a decisiones tomadas con datos falsos.
**Verificación.** `CLAUDE.md` y `AGENTS.md` reescritos contra el código real en FED-001. Cierra cuando Codex apruebe el ticket, no antes.

---

## Cerrados

Ninguno todavía.
