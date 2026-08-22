@AGENTS.md

# Sistema Fedra · contexto para Claude Code

Claude actúa como arquitecto e integrador. Toma los carriles de dinero, permisos, arquitectura y operación. Las reglas compartidas con Codex están en `AGENTS.md` y mandan sobre este archivo.

Corte de información: 14 de agosto de 2026, commit base `ae7aaed`.

## Coordenadas

- Producción: https://sistema-fedra.vercel.app
- Repositorio: github.com/Dantemvp/POS-Dra-Fedra, rama `main`
- Supabase: proyecto `kxtznwgdpvbtlsedmjap`
- Vercel: scope `dantemvps-projects`
- Clon de auditoría en la PC de Dante: `C:\Users\Alex\POS-Dra-Fedra-audit`

## Stack real

Next 16.2.6 con App Router, React 19.2.4, Supabase con Postgres, Auth SSR y Storage, Tailwind v4 y Recharts. La interfaz es propia, no hay shadcn/ui ni Radix a pesar de lo que decían las notas viejas. Para imprimir y generar códigos se usan jspdf, html2canvas-pro y jsbarcode. Las notificaciones van por web-push.

El lector de InBody llama a GPT-4o por fetch directo a la API de OpenAI, sin SDK, en `src/app/(app)/pacientes/actions.ts`.

## Tamaño

99 archivos TypeScript con unas 11,800 líneas. 40 migraciones SQL con unas 2,300 líneas, la última es `20260628000040_google_calendar.sql`. 21 archivos `page.tsx` en total, de los cuales 19 pertenecen al grupo autenticado `(app)` y los otros dos son la raíz y `/login`. 13 archivos con server actions, 46 componentes de cliente contando `src/app` y `src/components`, y 42 políticas de RLS declaradas.

## Variables de entorno que el código sí usa

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `CRON_SECRET`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`.

Las notas anteriores mencionaban `GOOGLE_API_KEY` y `FISH_AUDIO_API_KEY`. Ningún archivo del código las consume. Si siguen cargadas en Vercel, son riesgo sin beneficio y hay que quitarlas.

## Qué está construido

Farmacia: inventario con productos, lotes y caducidad, entradas y alertas de stock; punto de venta con la RPC `registrar_venta` en FIFO, ticket y folio; caja con reportes y libro de control COFEPRIS exportable; devoluciones con `cancelar_venta`; compras a proveedor con importación de CFDI en XML; escáner de código de barras; archivos de producto en el bucket `archivos` de Storage.

Consultorio: pacientes con historia clínica configurable por plantillas JSONB y formato NOM-004; recetas imprimibles sobre el recetario real con folio y código de barras que el POS escanea; lector de InBody por foto; agenda con vínculo hacia Google Calendar en un solo sentido; dashboard con gráficas.

Operación: pagos mixtos de efectivo y tarjeta con cálculo de cambio, corte del día con conteo y descuadre, historial de cortes con detalle y responsable, permisos por rol incluido gerente, notificaciones push y dos crons diarios.

## Dónde está la seguridad hoy

La frontera real es la RLS de Postgres más la revalidación de rol dentro de cada server action. Encima de eso hay una capa de middleware que sí autoriza. `src/middleware.ts` delega en `updateSession` de `src/lib/supabase/middleware.ts`, y esa función exige sesión fuera de las rutas públicas, consulta el rol del usuario en la tabla `usuarios` y controla doce prefijos de ruta declarados en `RUTAS_ROL`.

Esa capa es abierta por omisión. Una ruta autenticada que no aparece en `RUTAS_ROL` queda disponible para cualquier usuario con sesión, y el comentario del propio archivo lo declara. Hoy `/dashboard` y `/notificaciones` están en ese caso. El middleware tampoco cubre las server actions, así que cada una revalida el rol por su cuenta y ahí sigue estando la frontera que importa. El detalle vive en el hallazgo H-003.

La llave de servicio se usa en un único archivo, `src/lib/supabase/admin.ts`, y de ahí cuelgan los dos crons. Los dos validan `CRON_SECRET` con un header Bearer antes de hacer nada.

## Comandos

```bash
npm run dev        # local en :3000
npm run build
npm run lint
npx tsc --noEmit   # typecheck
```

El deploy a producción es manual y hacer push no publica nada. Requiere el token de Vercel, que está quemado y pendiente de rotación, así que hoy ningún agente despliega. Las migraciones se aplican con `supabase db push` desde la máquina de Dante y solo con su autorización.

## Deuda conocida

No hay pruebas automatizadas y no existe ningún workflow de integración continua. La carpeta `.github` sí existe desde FED-001, pero solo contiene la plantilla de pull request.

Del ambiente de pruebas hay andamio y no hay ambiente. `supabase/config.toml` declara un entorno local completo que nunca se ha levantado ni verificado, falta el `supabase/seed.sql` que ese mismo archivo referencia, y no existe un proyecto remoto separado para las vistas previas. Mientras eso siga así, la única base de datos operable es la de producción, con pacientes reales adentro, y cualquier verificación seria toca datos de la clienta. Esa es la primera pieza a construir.

## Gotchas técnicos

- Los triggers con enum necesitan cast explícito a `::rol_usuario`.
- Las RPC con RETURNING necesitan calificar la columna, por ejemplo `ventas.folio`, o el nombre queda ambiguo.
- El lector InBody devuelve la grasa visceral tomando el máximo del rango en vez del valor puntual. Se dejó editable a propósito. Si se retoma, probar con otro modelo o recortando la zona de la imagen.
- Sinaloa no cambia de horario. La lógica de día vive en `src/lib/tz.ts` y el corte de caja depende de ella.
- Los datos fiscales de la farmacia están en `src/lib/fiscal.ts`. Son de Aldama Farmacéutica, que es una entidad distinta del consultorio.

## Estado comercial

Fedra aceptó y pagó la Fase 1. Quedan pendientes que no son código: los formatos de receta sin definir, la carga de inventario que hace su equipo, la capacitación con procedimientos escritos y la identidad de marca. El vínculo bidireccional con Google Calendar y el timbrado real de facturas son fase posterior, y el timbrado depende de que la doctora tramite su CSD ante el SAT.
