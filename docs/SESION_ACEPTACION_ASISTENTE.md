# Sesión corta de aceptación · asistente

Versión reducida de `docs/MATRIZ_ACEPTACION_TESTER.md` para una sola sesión de 45 a 60 minutos con la asistente del consultorio, en el tester y nunca en el sistema de la clínica.

La matriz completa es el contrato técnico. Esto es el guion que se sigue en voz alta.

## Antes de empezar

Quien acompaña la sesión corre esto y guarda la salida:

```bash
node scripts/preflight-tester.mjs --remoto
```

Si sale con 1, la sesión no empieza. Comprueba que el destino sea el tester y no el sistema de la doctora.

La aplicación es `https://fedra-pos-tester.vercel.app`. Si la dirección que aparece en el navegador es otra, se detiene todo.

Todo lo que hay dentro empieza con `PRUEBA`. **No se captura ni un dato de una paciente real**, ni nombre, ni teléfono, ni fecha de nacimiento. Si la asistente propone usar un caso real "para que se parezca", se le agradece y se usa `PRUEBA Tester 01`.

## Credenciales

| Rol | Correo | Contraseña |
| --- | --- | --- |
| Asistente | `asistente@fedra.test` | `Prueba-FED004A!` |
| Doctora | `doctora@fedra.test` | `Prueba-FED004A!` |
| Farmacia | `farmacia@fedra.test` | `Prueba-FED004A!` |

La sesión se hace casi toda con la cuenta de asistente, que es la que ella va a usar. Las otras dos sólo aparecen en los pasos 6 y 7.

## Qué se captura como evidencia

Una captura de pantalla por paso, con el resultado a la vista. Además, quien acompaña anota en una hoja: paso, resultado observado, y si hubo duda de la asistente, la duda textual. **Las dudas valen tanto como los fallos**: si no entiende una pantalla, es un hallazgo de operación aunque el sistema funcione.

Nada de lo que se capture puede contener datos reales, porque no los habrá.

## Cuándo se detiene la sesión

Se para y se avisa a Dante, sin seguir al paso siguiente:

- Aparece un dato que no empieza con `PRUEBA`.
- La dirección del navegador deja de ser `fedra-pos-tester.vercel.app`.
- La asistente alcanza una pantalla de dinero de farmacia (ventas, caja, corte, inventario, compras).
- Algo se borra y no hay forma de recuperarlo.

Todo lo demás se anota y se sigue.

---

## Los pasos

### 1 · Entrar y reconocer su lugar (5 min)

Entra con `asistente@fedra.test`. Recorre el menú y dice en voz alta qué cree que hace cada opción.

**Se espera.** Ve pacientes, agenda y cobros. **No** ve ventas, caja, inventario, compras ni usuarios.

**Se anota.** Cualquier opción que ella no sepa nombrar. Un menú que hay que explicar es un menú que hay que cambiar.

### 2 · La puerta que no le toca (5 min)

Quien acompaña escribe a mano en el navegador `fedra-pos-tester.vercel.app/ventas` y luego `/inventario`.

**Se espera.** Las dos la sacan. No debe alcanzar a ver la pantalla ni por un instante.

**Criterio de detención.** Si entra, se detiene la sesión.

### 3 · Dar de alta una paciente (10 min)

Alta de `PRUEBA Tester 01`, con fecha de nacimiento, teléfono inventado y dirección inventada. Después, corregir el teléfono.

**Se espera.** Guarda, se relee igual, y la edad que muestra corresponde a la fecha capturada.

**Se anota.** Cuántos campos le costaron. Si preguntó qué es obligatorio, se anota textual: eso alimenta la decisión pendiente sobre qué exige la NOM-004 para cerrar una nota.

### 4 · Agendar una cita (5 min)

Agenda una cita para `PRUEBA Tester 01` esta semana y otra para la próxima. Después la mueve de hora.

**Se espera.** Aparece en la agenda en el día y hora correctos.

**Se anota.** Si la hora que ve coincide con la que esperaba. La hora de Sinaloa es un punto sensible del sistema y ella es quien lo va a notar primero.

### 5 · Subir un InBody (10 min)

Con la foto **sintética** preparada, no con un estudio real. Sube el archivo desde la ficha de `PRUEBA Ana`.

**Se espera.** Los campos se llenan solos, ella puede corregir cualquiera antes de guardar, y la grasa visceral queda editable.

Después se prueban dos archivos que deben rebotar: un PDF y una foto muy pesada.

**Se espera.** Los dos se rechazan con un mensaje que ella entienda, y rápido.

**Se anota.** Si el mensaje de rechazo le dice qué hacer. "Formato no permitido" no le sirve; "sube una foto JPG o PNG de menos de 10 MB" sí.

### 6 · Cobrar una consulta (10 min)

Con su misma cuenta, registra un cobro de `PRUEBA Consulta de control`, primero en efectivo y después dividido entre efectivo y tarjeta.

**Se espera.** La suma de las dos partes cuadra con el total, sin centavos de más ni de menos.

**Se anota.** Si el cálculo del cambio le resulta claro.

### 7 · Lo que ella no debe poder ver (5 min)

Este paso lo hace quien acompaña, con ella mirando, para que entienda por qué existe el candado.

Se entra con `farmacia@fedra.test` y se intenta abrir el expediente de `PRUEBA Ana`.

**Se espera.** Farmacia no ve historia clínica, ni consultas, ni recetas, ni el estudio de InBody.

**Por qué se le enseña.** Para que sepa que el sistema separa el consultorio de la farmacia, y que si alguien le pide "entrar con tu usuario para ver algo de la farmacia", eso no es normal y se reporta.

### 8 · Cierre (5 min)

Tres preguntas, y se anotan textuales:

1. ¿Qué pantalla le pareció más confusa?
2. ¿Qué hace hoy en papel que aquí no encontró dónde hacer?
3. **¿A qué hora cierra de verdad la farmacia?**

La tercera no es curiosidad. El aviso automático de cierre del día corre a las 21:00 de Sinaloa, y si la operación sigue después de esa hora el resumen queda corto. Es H-029 y se cierra con su respuesta, no con código.

---

## Al terminar

Quien acompaña deja en el pull request: la salida del preflight, las capturas por paso, la hoja de resultados y las tres respuestas del cierre. Los fallos se registran en `docs/HALLAZGOS.md` con su identificador antes de discutir corrección.

Si la sesión se detuvo, se anota en qué paso y por qué, y no se maquilla el resultado.
