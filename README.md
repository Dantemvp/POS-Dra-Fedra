# Sistema Fedra

POS web y expediente clínico de la Dra. Fedra Aldama. Integra farmacia y
consultorio en una aplicación Next.js con Supabase y Vercel.

## Empieza aquí

Si abres este proyecto en otra computadora o con una sesión nueva de Claude o
Codex, lee en este orden:

1. [`AGENTS.md`](AGENTS.md), reglas que nunca se omiten.
2. [`docs/ESTADO_ACTUAL.md`](docs/ESTADO_ACTUAL.md), estado operativo y prioridad vigente.
3. [`docs/RELEVO_MULTIAGENTE.md`](docs/RELEVO_MULTIAGENTE.md), cómo continuar entre PC, Mac, Claude y Codex.
4. [`docs/PROMPTS_ARRANQUE_MAC.md`](docs/PROMPTS_ARRANQUE_MAC.md), prompts listos para una sesión sin contexto.

El detalle técnico vive en:

- [`docs/HALLAZGOS.md`](docs/HALLAZGOS.md), riesgos y evidencia.
- [`docs/TICKETS.md`](docs/TICKETS.md), contratos de trabajo.
- [`docs/MATRIZ_ACEPTACION_TESTER.md`](docs/MATRIZ_ACEPTACION_TESTER.md), pruebas funcionales.
- [`docs/WORKFLOW_CLAUDE_CODEX.md`](docs/WORKFLOW_CLAUDE_CODEX.md), flujo de revisión cruzada.
- [`docs/RELEASES_Y_ROLLBACK.md`](docs/RELEASES_Y_ROLLBACK.md), liberación y reversa.

## Entornos

| Entorno | URL | Regla |
|---|---|---|
| Producción | <https://sistema-fedra.vercel.app> | Datos y ventas reales. Solo lectura sin autorización expresa de Dante. |
| Tester | <https://fedra-pos-tester.vercel.app> | Solo cuentas, pacientes, productos y operaciones sintéticas. |

Nunca se guardan secretos, contraseñas ni documentos clínicos en Git. Los
identificadores públicos de cada entorno y los comandos de verificación están
en `docs/ESTADO_ACTUAL.md`.

## Arranque local

```powershell
npm ci
npm run dev
```

Verificación mínima antes de entregar un cambio:

```powershell
npm run typecheck
npm run lint
npm test
npm run build
git diff --check
```

Antes de cualquier prueba remota contra Supabase:

```powershell
node scripts/preflight-tester.mjs --remoto
```

El preflight debe aceptar únicamente el proyecto tester autorizado. Un check
verde no autoriza despliegues, migraciones ni cambios en producción.
