# Plan maestro del Sistema Fedra

Corte de información: 13 de agosto de 2026.
Estado: propuesta de Claude para revisión de Dante y de Codex. Nada se ha ejecutado.
Base verificada: clon local en `C:\Users\Alex\POS-Dra-Fedra-audit`, rama `main`, commit `ae7aaed` del 28 de junio de 2026, sincronizado con `origin/main`.

## Por qué este plan no es el de Bianca

Bianca es un POS de Electron que se instala en las PCs de cada tienda. Su riesgo vive en la sincronización, el modo offline, los instaladores y los canales de actualización. Por eso allá construimos outbox, dead letter, identidad por caja y tres canales de release.

Fedra es una aplicación web con una sola base de datos. No hay instaladores ni modo offline. El riesgo se mueve a otro lado:

1. La frontera de seguridad es la RLS de Postgres y las server actions. Si una política falla, cualquiera con la llave anónima, que es pública por diseño, llega a los datos.
2. Los datos son expedientes clínicos de personas reales, con historia clínica NOM-004 y libro de control COFEPRIS. Bianca vende zapatos. Aquí un error de permisos es un problema legal, no solo comercial.
3. Existe una sola base de datos y es la de producción. Hoy no hay dónde probar nada sin tocar pacientes reales.

Ese tercer punto es el cuello de botella de todo lo demás. Bianca puede correr 303 pruebas porque su núcleo trabaja contra SQLite local. Fedra no tiene equivalente. Mientras no exista un ambiente de pruebas, cualquier suite que escribamos no tiene dónde correr y cualquier verificación seria se hace apuntando a la base de la doctora.

## Fotografía comprobada

- 99 archivos TypeScript, unas 11,800 líneas.
- 40 migraciones SQL, unas 2,300 líneas.
- 19 rutas de aplicación, 13 archivos con server actions, 39 componentes de cliente.
- 42 políticas de RLS declaradas en migraciones.
- Cero pruebas automatizadas. Cero integración continua. No existe carpeta `.github`.
- Stack real: Next 16.2.6, React 19.2.4, Supabase SSR. El `CLAUDE.md` del repo todavía dice Next 15 y apunta a un commit de hace meses.
- Los dos crons sí validan `CRON_SECRET` con Bearer. Ese punto está bien resuelto.
- La llave de servicio se usa en un solo lugar, `src/lib/supabase/admin.ts`. También está bien acotado.
- El middleware solo refresca la sesión. No autoriza rutas por rol.

## Fase 0 · Ordenar la casa

Nada de código todavía. Sin esto, dos agentes trabajando en paralelo se pisan.

- **F0-1 Rama canónica.** Confirmar que `origin/main` es la verdad y protegerla contra push directo. En Bianca perdimos tiempo porque la versión estable vivía en una rama y `main` quedó 128 commits atrás. Aquí todavía no pasa y conviene que no pase.
- **F0-2 Memoria del repo.** Reescribir `CLAUDE.md` con el estado real y crear un `AGENTS.md` de verdad, porque hoy solo tiene la advertencia de Next.js y es lo único que Codex va a leer como contexto. Los dos agentes parten del mismo archivo.
- **F0-3 Contrato de trabajo.** Adaptar el workflow de Bianca: semáforo de riesgo, tickets con un solo autor, revisión cruzada obligatoria, plantilla de PR, worktrees separados. Se cambia el prefijo a `FED-###`.
- **F0-4 Tablero de hallazgos.** Un solo archivo, `docs/HALLAZGOS.md`, donde los dos escribimos con el mismo formato: identificador, severidad, evidencia, impacto, verificación. Sin esto vuelve a pasar lo de ayer, dos reportes distintos diciendo lo mismo.
- **F0-5 Secretos.** Inventario y rotación. El token de Vercel vive en `/tmp/.vtoken_fedra` y se pegó dos veces en chat. Hay que rotarlo, junto con la llave de servicio de Supabase, la de OpenAI y el par de OAuth de Google. Mientras no se roten, cualquier hallazgo de seguridad que encontremos es secundario frente a esto.

## Fase 1 · Poder probar sin tocar a las pacientes

- **F1-1 Base de pruebas.** Un segundo proyecto de Supabase con las mismas 40 migraciones y datos sintéticos. Ni un solo registro real. Esta es la pieza que desbloquea todo.
- **F1-2 Semilla.** Script que carga inventario, lotes, pacientes falsos, servicios y usuarios de cada rol, para reproducir cualquier escenario en segundos.
- **F1-3 Integración continua.** GitHub Actions con typecheck, lint y build en cada push. Bianca dejó una lección concreta: nunca poner `|| echo` en el paso de typecheck, porque un check que no puede fallar es decoración y así se fueron dos pantallas en blanco a manos del usuario.
- **F1-4 Pruebas de la lógica de dinero.** Sin base de datos, funciones puras: el parser CFDI de `src/lib/cfdi.ts`, el cálculo de pagos mixtos y cambio, el corte de caja, y la zona horaria de `src/lib/tz.ts`. La zona horaria merece atención especial porque Sinaloa no cambia de horario y el corte del día depende de eso.
- **F1-5 Pruebas de las RPC.** Contra la base de pruebas: `registrar_venta`, `cancelar_venta`, corte, `productos_de_receta`.
- **F1-6 Previews.** Que los deploys de vista previa de Vercel apunten a la base de pruebas y no a producción.

## Fase 2 · Plan maestro de checks

Seis carriles. Cada uno tiene un dueño y ningún carril comparte archivos con otro, para que se puedan correr en paralelo.

### Carril A · Dinero

- A1 La venta es atómica de verdad, incluso si el navegador manda dos veces el mismo cobro.
- A2 El FIFO de lotes no deja stock negativo ni consume lote caducado.
- A3 Pagos mixtos: la suma de efectivo y tarjeta cuadra con el total, sin centavos perdidos por redondeo.
- A4 Cómo se representa el dinero en la base y en el navegador. Si en algún punto es coma flotante, hay que documentarlo y acotarlo.
- A5 Cancelaciones y devoluciones dejan rastro y devuelven el stock al lote correcto.
- A6 El corte del día usa la frontera horaria de Sinaloa y no la del servidor.
- A7 Un corte cerrado no cambia en silencio.
- A8 Los descuentos, si existen, tienen tope y autoridad.

### Carril B · Identidad y permisos

- B1 Cuántas de las tablas tienen RLS activa en producción, no en las migraciones. Esto se responde consultando el catálogo, no leyendo archivos.
- B2 Qué alcanza a leer la llave anónima sin sesión. Es pública, así que se prueba desde afuera.
- B3 Cada server action revalida el rol en el servidor. Ocultar un botón no autoriza nada.
- B4 El middleware no autoriza rutas. Verificar que cada página lo haga por su cuenta y que ninguna se quede sin candado.
- B5 Escalada de rol: que un usuario no pueda modificar su propia fila de `usuarios`.
- B6 La sesión caduca y se revoca bien al desactivar a alguien.

### Carril C · Datos de pacientes

- C1 Quién puede leer expedientes. La farmacia no debería ver historia clínica.
- C2 El bucket `archivos` de Storage: si es público, cualquier URL adivinada expone documentos de pacientes.
- C3 El lector InBody manda fotos a OpenAI. Es un dato de salud saliendo a un tercero. Hay que documentarlo, decidir si se avisa y dejarlo por escrito.
- C4 Registros de auditoría: quién vio y quién modificó cada expediente.
- C5 Los 509 pacientes que faltan migrar desde Sheets llegan con este candado ya puesto, no después.
- C6 Qué pasa si alguien pide borrar sus datos.

### Carril D · Farmacia y COFEPRIS

- D1 El libro de control cuadra con las ventas de medicamento controlado.
- D2 Lotes y caducidad: alertas correctas y bloqueo de venta de caducado.
- D3 El folio de receta con código de barras no se repite ni se adivina.
- D4 Los datos fiscales del ticket coinciden con los de la entidad correcta, porque son dos entidades COFEPRIS distintas.
- D5 El importador de CFDI valida el XML antes de creerle.

### Carril E · Integraciones

- E1 El callback de OAuth de Google valida el parámetro de estado contra CSRF.
- E2 Dónde y cómo se guardan los tokens de refresco de Google.
- E3 El vínculo con Calendar es de un solo sentido. Confirmar que un fallo ahí nunca tumba la agenda.
- E4 Las suscripciones de web push y a quién notifican.
- E5 Los crons ya validan el secreto. Falta confirmar que si fallan, alguien se entera.

### Carril F · Operación

- F1 Existen respaldos y hay una restauración ensayada. Bianca nos dejó clara la regla: un respaldo cuenta cuando ya lo restauraste.
- F2 El deploy es manual y hacer push no publica. Decidir si se automatiza o se documenta el procedimiento.
- F3 Reversa de migraciones. Hoy son aditivas, que es lo correcto, y conviene que siga siendo la regla.
- F4 Qué se ve cuando algo truena en producción. Hoy no hay monitoreo.

## Fase 3 · Remediación

Un ticket por hallazgo, ordenado por severidad y no por comodidad. Cada uno con su prueba que demuestra la corrección y su plan de reversa. Los cambios rojos, que son dinero, permisos y datos de pacientes, los escribe un agente y los revisa el otro, y Dante autoriza antes de que toquen producción.

## Fase 4 · Cerrar la Fase 1 comercial

Fedra ya aceptó y pagó. Falta lo que no es código: los formatos de receta que siguen sin definirse, la carga de inventario que hace su equipo, la capacitación y los procedimientos escritos, y la identidad de marca de Aldama Farmacéutica. Esto no depende de la auditoría y puede avanzar en paralelo.

## Cómo nos repartimos el trabajo

El problema de ayer fue que los dos hicimos el mismo reconocimiento y entregamos el mismo texto. La solución no es coordinarnos mejor al escribir, es que cada quien tenga un carril distinto y un producto distinto.

Propuesta: Claude toma arquitectura y remediación, o sea los carriles A, B y F. Codex toma revisión adversarial y pruebas, o sea los carriles C, D y E, donde su trabajo es romper cosas y documentar casos límite. Los dos escribimos en `docs/HALLAZGOS.md` con el mismo formato y ninguno aprueba su propio cambio.

Regla que nos ahorra tropiezos: si dos tareas tocan el mismo archivo, no son paralelas. Se ordenan.

## Primeros cinco movimientos

1. Rotar los secretos, empezando por el token de Vercel.
2. Levantar la base de pruebas con datos sintéticos.
3. Poner la integración continua con typecheck que sí pueda fallar.
4. Corregir el `CLAUDE.md` y escribir el `AGENTS.md` real.
5. Abrir los carriles A y B, que son dinero y permisos.
