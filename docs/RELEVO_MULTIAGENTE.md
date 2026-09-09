# Relevo entre PC, Mac, Claude y Codex

## Objetivo

Poder cambiar de computadora o cuenta sin perder contexto, duplicar trabajo ni
tocar producción por error. GitHub conserva decisiones y evidencia; Vercel y
Supabase conservan estado operativo. El chat no es la fuente canónica.

## Arranque en una computadora nueva

```bash
git clone https://github.com/Dantemvp/POS-Dra-Fedra.git
cd POS-Dra-Fedra
git fetch origin --prune
git switch --track origin/codex/fedra-integration
npm ci
```

No copies `.env.local` desde otra computadora. Vincula GitHub, Vercel y
Supabase con cuentas autorizadas y comprueba identidad y destino antes de operar.

```bash
gh auth login
vercel login
supabase login
supabase link --project-ref mvevriyiyuurjmwileoh
node scripts/preflight-tester.mjs --remoto
```

El último comando debe aprobar únicamente el tester. No enlaces este checkout
al identificador productivo.

Lee `README.md`, `AGENTS.md` y `docs/ESTADO_ACTUAL.md`. Después consulta solo el
ticket y los hallazgos que vas a trabajar.

## Selección del ticket

Antes de editar, escribe en el PR o en el ticket:

```text
Ticket:
Objetivo de esta sesión:
Entorno: local | tester | producción solo lectura
Autor/arquitecto:
Auditor/revisor:
Commit base:
Archivos permitidos:
Fuera de alcance:
Pruebas y reversa:
```

Si Claude se queda sin tokens, Codex puede continuar como autor únicamente
después de leer el commit, diff, pruebas y notas existentes. El nuevo agente
declara el relevo. Quien haya escrito cualquier parte material no actúa como
único revisor final.

## Regla para no sobrecomplicar

Clasifica cada descubrimiento:

- **Bloquea ahora:** puede perder o duplicar dinero, alterar inventario, romper
  permisos, exponer datos clínicos, impedir la reversa o invalidar el objetivo.
  Se atiende o se detiene el ticket.
- **Relacionado y pequeño:** se corrige si cabe en los archivos permitidos y
  se prueba sin ampliar el riesgo.
- **No bloquea:** se registra con evidencia y se continúa el objetivo actual.

Una mejora estética, una redacción imperfecta o deuda futura no detienen una
prueba crítica. Tampoco se aplica un parche rápido si afecta dinero o salud.

## Entrega obligatoria antes del relevo

El agente que termina o pausa deja:

```text
Estado: terminado | en curso | bloqueado
Rama y commit exactos:
Base exacta:
Archivos cambiados:
Pruebas ejecutadas y resultado:
Cambios externos realizados:
Tester o producción tocados:
Riesgos y pendientes reales:
Siguiente acción concreta:
Qué debe revisar el otro agente:
```

Además:

1. Commit pequeño y mensaje que mencione el ticket.
2. Push de la rama.
3. PR con evidencia, reversa y entorno afectado.
4. Actualización de `docs/ESTADO_ACTUAL.md` solo si cambió el estado operativo.
5. Ningún secreto o dato clínico en commits, comentarios o capturas públicas.

## Coordinación entre equipos

- Una rama por ticket y un solo autor activo.
- No editar los mismos archivos desde PC y Mac al mismo tiempo.
- Antes de continuar: `git fetch origin --prune` y comparar la punta remota.
- Un worktree viejo no demuestra el estado actual.
- Los hallazgos van a `docs/HALLAZGOS.md`; el alcance a `docs/TICKETS.md`.
- Las decisiones operativas y despliegues se reflejan en
  `docs/ESTADO_ACTUAL.md` y `docs/LIBERACIONES.md`.

## Límites de autoridad

Sin autorización expresa de Dante, ningún agente:

- despliega a producción;
- ejecuta migraciones productivas;
- lee, rota o copia secretos productivos;
- toca pacientes o ventas reales;
- fusiona un cambio rojo hacia `main`;
- convierte una RC en versión estable.

El tester acepta operaciones sintéticas. Aun ahí se ejecuta primero
`node scripts/preflight-tester.mjs --remoto` y se conserva una reversa.
