@AGENTS.md

# Sistema Fedra — Contexto del proyecto

## Qué es
POS + sistema clínico para **Dra. Fedra Yarissa Aldama Castro** (medicina estética + control de peso, Los Mochis, Sin.). Reemplaza un AppSheet fallido. Construido por Dante Vega (`adantevele@gmail.com`).

## URLs y repositorio
- **Producción:** https://sistema-fedra.vercel.app
- **GitHub:** github.com/Dantemvp/POS-Dra-Fedra (rama `main`)
- **Supabase proyecto:** `kxtznwgdpvbtlsedmjap` (Fedra POS)
- **Vercel scope:** `dantemvps-projects`

## Stack
Next.js 15 (App Router) · Supabase (Postgres + SSR Auth + Storage) · Tailwind + shadcn/ui · Recharts · OpenAI GPT-4o (visión InBody)

## Comandos clave
```bash
# Dev local
npm run dev   # :3000

# Deploy producción (token en /tmp/.vtoken_fedra — pedir nuevo si expiró)
git push && npm_config_cache=/tmp/npmcache-fedra npx vercel@latest deploy --prod --yes \
  --scope dantemvps-projects --token "$(cat /tmp/.vtoken_fedra)"

# Migraciones DB
supabase db push   # CLI autenticado en Mac de Dante
```

## Credenciales
`.env.local` (gitignored): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`, `FISH_AUDIO_API_KEY`. También cargadas en Vercel producción. Login admin: `dantevega95`.

## Qué está hecho (commit `5dd7402` deployed)

### Fase 1 — Farmacia ✅
Inventario (productos, lotes, caducidad, entradas, alertas), POS (RPC `registrar_venta` FIFO atómica, ticket, folio), Caja + reportes + Libro Control COFEPRIS + CSV, Devoluciones (`cancelar_venta`), Compras a proveedor (`/compras`), Editar producto (`/inventario/[id]`), Archivos en productos (Supabase Storage bucket `archivos`), Escáner código de barras (BarcodeDetector nativo).

### Fase 2 — Consultorio ✅
Pacientes + HC configurable (plantillas JSONB), HC NOM-004-SSA-2012 (55 campos, 12 secciones), Recetas imprimibles con recetario REAL como fondo (`public/recetario.png`, media carta 8.5×5.5in horizontal), Precarga último InBody en receta, Lector InBody IA (GPT-4o → pre-llena formulario), Editar/eliminar historias, HC imprimible con membrete (`public/logo.png`), Dashboard con gráficas (Recharts).

## Datos de la Dra. (membrete / receta)
Dra. Fedra Yarissa Aldama Castro · Médico Cirujano, UAG · Céd. Prof. 11015233 · S.S.A. 20982 · Tel 668 146 35 02 · Blvd Río Fuerte 2677, Viñedos, Los Mochis, Sin.

## Branding del cliente
`/Volumes/Dante SSD/PM/FEDRA/Branding/` — logo .ai, recetario PDF, hoja membrete.
Para rasterizar PDFs: `qlmanage -t -s 2000 -o /tmp/out archivo.pdf` (no hay poppler).

## Pendientes (orden de prioridad)
1. Probar en dispositivo real — HC membrete + receta con métricas (ajustar posiciones si se corren al imprimir)
2. **Agenda** — tabla `citas` ya en DB; falta UI. Recordatorios: empezar con `wa.me` click-to-WhatsApp (gratis); Meta Cloud API = complejo/caro
3. Conectar GitHub↔Vercel auto-deploy (Vercel dashboard → Settings → Git)
4. Migrar 509 pacientes + catálogo desde Google Sheets (necesita acceso `expclinicodental@gmail.com`)
5. Permisos por rol — proteger rutas según rol staff vs admin
6. Receta métricas — bloque Nombre/Fecha/Peso/IMC/Cintura + firma (formato real de la Dra.)
7. Plantilla NOM-004 completa — la sembrada es básica

## Entidades legales
Dos entidades COFEPRIS independientes: **Aldama Farmacéutica** (farmacia) y **Consultorio Dra. Fedra Aldama** (clínica). Meds controlados (Victoza, Norex, Relsus) requieren libro de control con lote/caducidad/balance.

## Gotchas técnicos
- Trigger enum necesita cast `::rol_usuario`
- RPC RETURNING necesita calificar `ventas.folio`
- InBody quirk: grasa visceral lee máximo del rango en vez del valor puntual — decisión: dejar editable. Si se retoma: probar gpt-4.1 o recortar zona de imagen
- Token Vercel en `/tmp/.vtoken_fedra` — expira entre sesiones; pedir nuevo al usuario si falla

## Docs de referencia
- `/Volumes/Dante SSD/PM/FEDRA/Plan-Desarrollo-Sistema-Fedra.md` — roadmap completo
- `/Volumes/Dante SSD/PM/FEDRA/Diagnostico-AppSheet-DraFedra-v5.md` — auditoría AppSheet
