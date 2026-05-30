# Sistema Integrado — Dra. Fedra Aldama

Reemplazo del POS/clínica que vivía en AppSheet (app "Dra. Fedra v.5"). Un solo sistema
integrado: farmacia + consultorio, sobre una base de datos normalizada y segura.

> Contexto y diagnóstico: ver `../Diagnostico-AppSheet-DraFedra-v5.md`
> Plan y esquema: ver `../Plan-Desarrollo-Sistema-Fedra.md`

## Stack
- **DB/Backend:** Supabase (PostgreSQL, Auth, RLS, Storage)
- **Frontend:** Next.js (App Router) + Tailwind + shadcn/ui *(pendiente de scaffold)*
- **Hosting:** Vercel
- **Conexiones:** WhatsApp Cloud API (recordatorios), PDF server-side (recetas)

## Estado actual
- [x] `supabase init`
- [x] Esquema inicial — `supabase/migrations/20260529000001_esquema_inicial.sql` (25 tablas, 1 vista)
- [x] RLS y roles — `supabase/migrations/20260529000002_rls_y_roles.sql` (51 políticas + auditoría)
- [x] Migraciones validadas con PGlite (aplican sin error)
- [x] Proyecto Supabase en la nube — `kxtznwgdpvbtlsedmjap` (Fedra POS)
- [x] **Migraciones aplicadas en remoto** (`supabase db push` OK; historial Local=Remote)
- [x] Scaffold Next.js 16 + Supabase SSR + login/middleware + shell por rol
- [x] **Fase 1 (farmacia) completa y verificada end-to-end:**
  - [x] Entrega 1 — Inventario (productos, lotes/caducidad, entradas, alerta stock mínimo)
  - [x] Entrega 2 — Punto de venta (RPC atómica, FIFO, ticket imprimible)
  - [x] Entrega 3 — Caja + reportes + Libro de Control COFEPRIS (export CSV)
- [ ] Fase 2 (consultorio): pacientes, HC configurable, recetas PDF, agenda + WhatsApp
- [ ] Migración de datos desde Google Sheets (catálogo + 509 pacientes)
- [ ] Pendiente menor: renombrar `middleware.ts` → `proxy.ts` (Next 16)

## Cómo correr en local
```bash
npm install
npm run dev      # http://localhost:3000
```
Primer usuario: créalo en Supabase Dashboard → Authentication → Add user (Auto Confirm).
La primera cuenta queda como `admin` automáticamente.

## Roles (RLS)
| Rol | Acceso |
|-----|--------|
| `admin` | Todo |
| `farmacia` | POS, inventario, caja; lee pacientes |
| `doctora` | Historia clínica, recetas, agenda; lee catálogo |
| `asistente` | Agenda, pacientes, seguimientos |

## Cómo aplicar el esquema (cuando exista el proyecto Supabase)
```bash
# 1) Enlazar al proyecto (Dante inicia sesión)
supabase login
supabase link --project-ref <PROJECT_REF>

# 2) Aplicar migraciones
supabase db push
```
Para desarrollo local (requiere Docker): `supabase start && supabase db reset`.

## Roadmap por entregas
**Fase 1 (farmacia):** 1) Inventario · 2) Punto de venta · 3) Caja + reportes + Libro de Control COFEPRIS
**Fase 2 (consultorio):** 4) Pacientes + HC configurable · 5) Recetas en 1 clic · 6) Agenda + WhatsApp

## Pendientes a validar con Raúl (socio técnico)
- Esquema de datos y políticas RLS antes de construir features.
- Cumplimiento COFEPRIS del Libro de Control (lote, caducidad, balance; Fracción I vía SER).
- Plan de migración de datos y respaldos.
