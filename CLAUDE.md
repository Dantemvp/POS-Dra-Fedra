@AGENTS.md

# Sistema Fedra · entrada para Claude Code

Este archivo es deliberadamente corto. Claude lo carga automáticamente; el
estado que cambia con cada despliegue vive en documentos versionados y no se
duplica aquí.

## Lectura obligatoria al iniciar

1. `README.md`
2. `AGENTS.md`
3. `docs/ESTADO_ACTUAL.md`
4. `docs/RELEVO_MULTIAGENTE.md`
5. El ticket elegido en `docs/TICKETS.md`
6. Solo los hallazgos relacionados en `docs/HALLAZGOS.md`

Antes de concluir que el contexto está vigente, verifica:

```bash
pwd
git status -sb
git remote -v
git fetch origin --prune
git log -12 --oneline --decorate --all --date-order
gh auth status
gh pr list --state open --limit 20
gh release list --limit 10
```

La rama canónica, los commits desplegados y las coordenadas de tester y
producción se consultan en `docs/ESTADO_ACTUAL.md`. La evidencia actual gana si
contradice ese archivo; después se actualiza el documento en el mismo PR.

## Papel de Claude

Claude suele aportar arquitectura, dinero, permisos y operación, pero no es un
papel fijo. Cada ticket declara quién actúa como autor/arquitecto y quién como
auditor/revisor. Claude y Codex pueden intercambiarse por disponibilidad o
tokens. El autor nunca es su único aprobador.

## Seguridad entre checkouts

Un checkout con `.env.local`, vínculo Supabase o vínculo Vercel de producción
se considera productivo aunque la rama cambie. No ejecutes `npm run dev`,
pruebas remotas, migraciones o scripts desde ahí para trabajo del tester.

Crea otro checkout o worktree exclusivo del tester. No copies `.env.local` ni
secretos entre equipos. Autentica cada proveedor en la máquina y ejecuta:

```bash
node scripts/preflight-tester.mjs --remoto
```

El preflight debe aceptar únicamente el proyecto tester autorizado. Si no
existe en el checkout, si falta identidad o si aparece cualquier vínculo con
producción, continúa solo con inspección de lectura.

## Regla de foco

No abras una auditoría completa dentro de cada tarea. Solo interrumpe el
objetivo un hallazgo que pueda comprometer dinero, inventario, permisos, datos
clínicos, despliegue o reversa. Registra los pendientes no bloqueantes y termina
el ticket actual.

## Estado técnico durable

- Next.js con App Router, React, Supabase Auth/Postgres/Storage y Vercel.
- Farmacia y consultorio son áreas relacionadas pero jurídicamente distintas.
- La frontera de seguridad real es RLS más validación de rol en servidor.
- Las pruebas de aplicación usan Vitest; CI ejecuta `verify` y `politicas`.
- Los hallazgos vigentes pertenecen a `docs/HALLAZGOS.md`, no a este archivo.
- La impresión clínica, InBody y aceptación operativa se siguen en los tickets
  vigentes y en `docs/MATRIZ_ACEPTACION_TESTER.md`.

No guardar aquí rutas personales de una computadora, conteos que se vuelvan
obsoletos, contraseñas, tokens ni datos clínicos.
