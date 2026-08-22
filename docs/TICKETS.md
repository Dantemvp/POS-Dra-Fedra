# Tickets · Sistema Fedra

Registro de tickets `FED-###`. El formato del contrato está en `docs/WORKFLOW_CLAUDE_CODEX.md`. Los hallazgos van en `docs/HALLAZGOS.md`.

## En curso

### FED-001 Contrato de trabajo y contexto del repositorio

Modo: Remediación · Riesgo: Verde · Carril: F operación
Autor: Claude · Revisor: Codex
Estado: primera revisión de Codex con cambios solicitados, corregidos en un segundo commit, pendiente de segunda revisión, sin subir

**Objetivo.** Dejar una sola fuente de verdad para los dos agentes antes de que cualquiera toque código del sistema.

**Qué incluye.** `AGENTS.md` con las reglas compartidas, el semáforo de riesgo y los invariantes del dominio. `CLAUDE.md` reescrito contra el código real. `docs/HALLAZGOS.md` con formato y los seis hallazgos ya confirmados. `docs/WORKFLOW_CLAUDE_CODEX.md` con el flujo adaptado a una aplicación web. `docs/TICKETS.md`, este archivo. `.github/PULL_REQUEST_TEMPLATE.md`. Se suma `docs/PLAN_MAESTRO_FEDRA.md`, que quedaba fuera de control de versiones.

**Fuera de alcance.** Nada de `src/`, nada de `supabase/`, ninguna credencial, ningún despliegue. No se crean workflows de integración continua porque eso es FED-002 y es de Codex.

**Criterios de aceptación.** Ningún dato del contexto contradice el código. Los dos agentes pueden citar el mismo archivo para resolver una duda de alcance o de permisos.

**Plan de reversa.** Son archivos de documentación en una rama propia. Se descarta la rama y no queda rastro en `main`.

**Verificación hecha.** Se comprobó contra el código que el stack es Next 16.2.6 y React 19.2.4, que no hay dependencias de shadcn ni Radix, que la llave de servicio se usa solo en `src/lib/supabase/admin.ts`, que los dos crons validan `CRON_SECRET`, que el middleware exige sesión fuera de rutas públicas y controla doce prefijos por rol con `RUTAS_ROL`, y que el código consume nueve variables de entorno y ninguna es `GOOGLE_API_KEY` ni `FISH_AUDIO_API_KEY`.

## Siguientes

### FED-002 Línea base de integración continua y pruebas puras

Modo: Remediación · Riesgo: Ámbar · Carril: F operación
Autor: Codex · Revisor: Claude
Estado: por abrir, no comienza hasta que FED-001 quede corregido, revisado e integrado

Integración continua con typecheck, lint y build, sin pasos que no puedan fallar. La carpeta `.github` ya existe con la plantilla de pull request, así que lo que falta es el workflow. Pruebas de las funciones puras de dinero y fecha: el parser de CFDI en `src/lib/cfdi.ts`, el cálculo de pagos mixtos y cambio, el corte de caja y la zona horaria de `src/lib/tz.ts`. Sin base de datos, porque todavía no existe ambiente de pruebas.

`package.json` queda reservado para este ticket. Ningún otro ticket lo toca mientras FED-002 esté abierto, incluido el script de typecheck que hoy no existe y que la integración continua va a necesitar.

### FED-003 Rotación del token de despliegue

Modo: Remediación · Riesgo: Rojo · Carril: F operación
Autor: Dante · Revisor: Claude
Estado: por abrir, cierra H-001

Solo Dante ejecuta. Se rota el token de Vercel y la credencial nueva no vuelve a pasar por chat. Las llaves de Supabase, OpenAI y el par de OAuth de Google no se tocan hasta confirmar su exposición y sus dependencias, porque de la llave de servicio cuelgan los dos crons y el OAuth ya tiene a la doctora conectada.

### FED-004A Ambiente de pruebas local

Modo: Remediación · Riesgo: Rojo · Carril: F operación
Autor: Claude · Revisor: Codex
Estado: por abrir, no comienza todavía, cierra la primera mitad de H-002

Levantar el entorno local que `supabase/config.toml` ya declara, con las 40 migraciones aplicadas y datos sintéticos. Incluye el `supabase/seed.sql` que ese archivo referencia y que no existe: inventario con lotes y caducidades, pacientes falsos, servicios y un usuario por cada rol. Desbloquea las pruebas de RPC, de RLS desde fuera con la llave anónima local, y de concurrencia. Ni un solo registro real.

Archivos permitidos: `supabase/seed.sql`, los ajustes de configuración local que haga falta en `supabase/config.toml`, y documentación propia bajo `docs/`. Fuera de alcance: `package.json`, que está reservado para FED-002; `src/`; las migraciones existentes, que no se reescriben; y producción.

### FED-004B Proyecto remoto para vistas previas

Modo: Remediación · Riesgo: Rojo · Carril: F operación
Autor: Claude · Revisor: Codex · Autoriza: Dante
Estado: por abrir, no comienza todavía, cierra la segunda mitad de H-002

Segundo proyecto de Supabase en la nube para que las vistas previas de Vercel dejen de apuntar a la base de la doctora. Crea un recurso y credenciales nuevas, así que no se toca sin autorización expresa de Dante. Conviene que espere a FED-003, porque configurar vistas previas con el token de despliegue todavía sin rotar es trabajar sobre una credencial que sabemos comprometida.
