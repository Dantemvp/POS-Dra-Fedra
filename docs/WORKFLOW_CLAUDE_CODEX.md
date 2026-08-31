# Flujo de trabajo · Claude y Codex en Sistema Fedra

Adaptado del flujo que ya opera en Bianca POS. Las diferencias vienen de que Fedra es una aplicación web con una sola base de datos, no un programa instalado en las PCs de las tiendas. Aquí no hay instaladores, canales de release ni modo offline. La frontera de seguridad es la RLS de Postgres, y los datos son expedientes clínicos.

Las reglas cortas y estables viven en `AGENTS.md`. Este documento explica el flujo completo.

## Quién hace qué

Dante define prioridades, confirma reglas de negocio y es la autoridad final sobre producción, credenciales y migraciones.

Claude toma arquitectura e integración, y es el autor principal de los carriles A de dinero, B de permisos y F de operación.

Codex toma revisión independiente y pruebas adversariales, y es el autor principal de los carriles C de pacientes, D de farmacia y E de integraciones.

Los dos pueden implementar. Ninguno aprueba su propio trabajo. Ninguno edita el mismo archivo al mismo tiempo que el otro.

## Contrato mínimo de un ticket

```markdown
# FED-### Nombre corto

Modo: Auditoría | Diagnóstico | Remediación | Incidente
Riesgo: Rojo | Ámbar | Verde
Carril: A | B | C | D | E | F
Autor: Claude | Codex
Revisor: Claude | Codex | Dante

## Objetivo
## Regla de negocio confirmada
## Archivos o módulos permitidos
## Fuera de alcance
## Invariantes que no deben romperse
## Criterios de aceptación
## Pruebas requeridas
## Plan de reversa
```

Si dos tickets necesitan editar el mismo archivo, no son paralelos. Se ordenan o se redefine su alcance.

## Flujo de un cambio

1. Dante aprueba el ticket y se registra en `docs/TICKETS.md`.
2. Se clasifica el riesgo con el semáforo de `AGENTS.md`.
3. Para cambios rojos o ámbar que crucen módulos, Claude escribe primero una nota de arquitectura.
4. Se nombra autor y revisor.
5. El autor crea su rama desde la rama canónica, con su prefijo.
6. El autor registra la línea base: qué pasaba antes de tocar nada.
7. El autor implementa el cambio más pequeño que cumple el ticket.
8. El autor agrega la prueba que demuestra la corrección, cuando es viable.
9. El autor abre el pull request con evidencia y plan de reversa.
10. El revisor lee el diff, corre las pruebas y busca el caso que rompe el cambio.
11. El autor resuelve. El revisor vuelve a aprobar después del último cambio.
12. La integración continua corre typecheck, lint, build y pruebas.
13. Dante autoriza el merge cuando el riesgo lo pide.
14. El despliegue a producción lo hace Dante, porque es manual y no ocurre por hacer push.

## Ramas y worktrees

Los dos agentes trabajan en carpetas distintas conectadas al mismo repositorio.

La rama canónica de integración es `codex/fedra-integration`. `main` representa únicamente lo que Dante ya autorizó para liberación y puede quedar detrás mientras una tanda sigue en revisión. Ninguna rama nueva parte de `origin/main` por costumbre: primero se actualiza la rama canónica y se registra el commit base del ticket.

```powershell
git fetch origin
git branch --force fedra-integration-base origin/codex/fedra-integration
git worktree add -b claude/FED-123-descripcion C:\Users\Alex\fedra-worktrees\claude-FED-123 fedra-integration-base
git worktree add -b codex/FED-124-descripcion C:\Users\Alex\fedra-worktrees\codex-FED-124 fedra-integration-base
git worktree list
```

`fedra-integration-base` es un apuntador local de solo arranque. No se trabaja directamente sobre él y no sustituye la revisión del commit exacto desde el que nació cada ticket.

Ningún worktree recibe copias de secretos productivos.

## Formato del pull request

Está en `.github/PULL_REQUEST_TEMPLATE.md` y se llena completo. Un pull request sin evidencia ni plan de reversa no se revisa.

## Reversa

Deshacer con el editor no es reversa de repositorio. El proyecto usa commits pequeños, un pull request por tarea, `git revert` para invertir lo ya compartido, y etiquetas para lo que se publica. No se usa `git reset --hard` sobre trabajo compartido.

Para la base de datos, las migraciones son aditivas y se ensaya la restauración antes de aplicar cualquier cambio estructural en producción.

## Lo que Bianca ya nos enseñó y aquí aplica igual

Un typecheck que no puede fallar es decoración. En Bianca el paso de CI llevaba `|| echo`, siempre salía verde, y dos pantallas llegaron en blanco a manos de Dante por variables sin declarar que el compilador habría cazado en segundos.

Un respaldo cuenta cuando ya lo restauraste.

La rama canónica se define antes de trabajar en paralelo. En Bianca la versión estable vivía en una rama de trabajo mientras `main` quedó 128 commits atrás, y reconciliar eso costó tiempo que no estaba presupuestado.

## Lo que en Bianca no existía y aquí sí

Los datos son historia clínica bajo NOM-004 y libro de control COFEPRIS. Un error de permisos deja de ser un problema comercial y pasa a ser uno legal.

La llave anónima de Supabase es pública por diseño. La única cosa entre esa llave y los expedientes son las políticas de RLS. Se prueban desde afuera, como lo haría un extraño, no leyendo los archivos de migración.

No hay ambiente de pruebas todavía. Mientras no exista, ninguna prueba toca la base de producción y las verificaciones se limitan a funciones puras.
