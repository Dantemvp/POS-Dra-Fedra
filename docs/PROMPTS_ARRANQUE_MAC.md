# Prompts de arranque para Mac

Estos prompts no sustituyen la verificación. Obligan a una sesión nueva a leer
la fuente canónica antes de trabajar.

## Claude Code

```text
Retoma el Sistema Fedra desde el repositorio local. No confíes en el historial
de esta conversación ni en resúmenes externos. Primero verifica pwd, identidad
GitHub, remotos, rama, status, worktrees, fetch, PR abiertos, releases y estado
HTTP de tester y producción.

Lee completos README.md, AGENTS.md, CLAUDE.md, docs/ESTADO_ACTUAL.md y
docs/RELEVO_MULTIAGENTE.md. Después lee docs/TICKETS.md y únicamente los
hallazgos relacionados con la tarea que elijamos.

La rama canónica es codex/fedra-integration. Producción contiene datos reales y
permanece en solo lectura sin autorización expresa de Dante. El tester es
fedra-pos-tester.vercel.app y solo admite datos PRUEBA. Antes de cualquier
operación remota ejecuta node scripts/preflight-tester.mjs --remoto y confirma
que el destino sea mvevriyiyuurjmwileoh, nunca kxtznwgdpvbtlsedmjap.

Claude y Codex intercambian los papeles de autor/arquitecto y auditor/revisor
según el ticket y disponibilidad. Declara cuál tomas. El autor no aprueba su
propio trabajo. Si recibes un relevo, verifica commit, diff y pruebas antes de
continuar.

Regla de foco: no sobrecomplejices. Atiende el objetivo principal. Solo lo
interrumpe un hallazgo que comprometa dinero, inventario, permisos, datos
clínicos, despliegue o reversa. Registra el resto y continúa.

Termina tu actualización con: estado real, contradicciones encontradas,
prioridad recomendada y el ticket concreto que puedes comenzar. No modifiques
nada hasta haber identificado entorno, base y alcance.
```

## Codex Desktop o CLI

```text
Retoma el Sistema Fedra desde el repositorio local usando GitHub como fuente
canónica, no la memoria del chat. Verifica primero pwd, git status, rama,
remotos, fetch, log, PR, releases, enlace Vercel y respuesta de tester y
producción.

Lee completos README.md, AGENTS.md, docs/ESTADO_ACTUAL.md y
docs/RELEVO_MULTIAGENTE.md. Lee CLAUDE.md para conocer el contexto compartido,
pero actúa como Codex. Después consulta el ticket y solo los hallazgos de su
alcance.

La rama canónica es codex/fedra-integration. Producción es solo lectura salvo
autorización expresa. Tester usa datos PRUEBA y el Supabase autorizado
mvevriyiyuurjmwileoh. Ejecuta node scripts/preflight-tester.mjs --remoto antes
de cualquier operación remota; kxtznwgdpvbtlsedmjap es producción y no se toca.

Declara si eres autor/arquitecto o auditor/revisor para el ticket actual. Los
papeles pueden intercambiarse entre Claude y Codex, pero nadie aprueba su propio
cambio. Verifica siempre el relevo anterior desde el commit y el diff.

Regla de foco: no conviertas una observación menor en una auditoría infinita.
Solo detén el objetivo por riesgo material sobre dinero, inventario, permisos,
datos clínicos, despliegue o reversa. Registra lo demás como pendiente.

Entrega primero un resumen corto del estado confirmado y una siguiente acción
concreta. No modifiques nada hasta confirmar entorno, base y alcance.
```

## Prompt corto de relevo

```text
Lee docs/ESTADO_ACTUAL.md y docs/RELEVO_MULTIAGENTE.md. Actualiza Git y GitHub,
verifica la evidencia del último agente y continúa el ticket indicado en su PR.
Declara autor y revisor, no toques producción ni datos reales, y no amplíes el
alcance por pendientes no bloqueantes.
```
