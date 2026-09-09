// Retiro administrativo de un documento clínico mal asignado (FED-014).
//
// Se ejecuta a mano, fuera de la aplicación, con la llave de servicio. No hay
// RPC ni server action que haga esto: una función expuesta al cliente sería el
// borrado que la regla prohíbe, con otro nombre.
//
//   node scripts/retiro-clinico.mjs \
//     --path "inbody/<paciente>/<archivo>.png" \
//     --motivo "Se subió el InBody de otra paciente por error en la captura del 12 de agosto" \
//     --responsable "Dra. Fedra Aldama" \
//     --ejecutor asistente@ejemplo.mx \
//     --confirmo
//
// Qué hace, en este orden y a propósito:
//   1. registra el retiro en `retiros_clinicos`, sin sellar;
//   2. mueve el objeto a `cuarentena/<id del retiro>/<archivo>`, un prefijo que
//      no aparece en ninguna política del bucket y que por lo tanto ningún rol
//      alcanza;
//   3. sella `movido_en`.
//
// Registrar antes de mover es lo que hace que una interrupción deje un retiro a
// medias y visible, en vez de un archivo desaparecido sin explicación.
//
// RECUPERACIÓN. Los tres pasos son tres escrituras distintas y cualquiera de
// las dos junturas se puede cortar. Por eso el script no empieza por el objeto:
// empieza por el retiro registrado y después mira en cuál de los dos extremos
// están los bytes. Volver a correr el mismo comando retoma el retiro pendiente
// y hace sólo lo que falte. Si se cortó entre el registro y el movimiento,
// mueve y sella. Si se cortó entre el movimiento y el sello, sella y ya. Y si
// el objeto está en los dos extremos, o en ninguno, se detiene: en ese punto no
// puede saber qué pasó y prefiere no inventarlo.
//
// La fila de `documentos_clinicos` no se toca. Queda apuntando a una ruta que
// ya no responde, y esta bitácora dice por qué.

import { createClient } from "@supabase/supabase-js";

const BUCKET = "archivos";
const MOTIVO_MINIMO = 20;

function argumento(nombre) {
  const i = process.argv.indexOf(`--${nombre}`);
  if (i < 0) return null;
  const valor = process.argv[i + 1];
  if (!valor || valor.startsWith("--")) return null;
  return valor;
}

function morir(mensaje) {
  console.error(`\nRetiro no ejecutado: ${mensaje}`);
  process.exit(1);
}

const path = argumento("path");
const motivo = argumento("motivo");
const responsable = argumento("responsable");
const ejecutor = argumento("ejecutor");
const confirmado = process.argv.includes("--confirmo");

if (!path) morir("falta --path con la ruta exacta del objeto dentro del bucket.");
if (!path.startsWith("inbody/")) morir("este procedimiento es sólo para documentos clínicos bajo inbody/.");
if (!motivo || motivo.trim().length < MOTIVO_MINIMO) {
  morir(`el motivo es obligatorio y debe explicar el caso en al menos ${MOTIVO_MINIMO} caracteres.`);
}
if (!responsable || responsable.trim().length < 3) {
  morir("falta --responsable con el nombre de quien autoriza el retiro.");
}

const API_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!API_URL) morir("falta SUPABASE_URL en el ambiente.");
if (!SERVICE) morir("falta SUPABASE_SERVICE_ROLE_KEY en el ambiente.");

console.log("Retiro administrativo de un documento clínico");
console.log(`  destino     ${new URL(API_URL).host}`);
console.log(`  objeto      ${path}`);
console.log(`  motivo      ${motivo.trim()}`);
console.log(`  responsable ${responsable.trim()}`);
if (!confirmado) {
  morir(
    "falta --confirmo. Lee las tres líneas de arriba antes de repetir el comando; " +
      "el destino que dice es la base que se va a modificar.",
  );
}

const admin = createClient(API_URL, SERVICE, { auth: { persistSession: false } });

async function existeObjeto(ruta) {
  const { data } = await admin.storage.from(BUCKET).download(ruta);
  return data !== null && data !== undefined;
}

async function sellar(id) {
  const { error } = await admin
    .from("retiros_clinicos")
    .update({ movido_en: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    morir(
      `el objeto ya está en cuarentena pero no se pudo sellar el retiro: ${error.message}. ` +
        "Vuelve a correr el mismo comando: retoma este retiro y sólo le falta el sello.",
    );
  }
}

// 1. ¿Ya hay un retiro para esta ruta? `path_original` es único, así que a lo
// sumo hay uno, y su sello dice en qué punto se quedó.
const { data: previo, error: eBuscar } = await admin
  .from("retiros_clinicos")
  .select("id, path_cuarentena, movido_en, motivo, solicitado_en")
  .eq("path_original", path)
  .maybeSingle();
if (eBuscar) morir(`no se pudo consultar la bitácora de retiros: ${eBuscar.message}`);

if (previo?.movido_en) {
  morir(
    `esa ruta ya se retiró el ${previo.solicitado_en} con el retiro ${previo.id}. ` +
      "Un documento no se retira dos veces, y el motivo del primer retiro es el que vale.",
  );
}

// 2. Dónde están los bytes. Se pregunta después de conocer el retiro, no antes:
// si el corte fue justo después de mover, el objeto ya no está en su ruta
// original y detenerse ahí dejaría el retiro sin sellar para siempre.
if (previo) {
  console.log(`  retomando   retiro ${previo.id}, registrado y sin sellar.`);

  const enOrigen = await existeObjeto(path);
  const enDestino = await existeObjeto(previo.path_cuarentena);

  if (enOrigen && enDestino) {
    morir(
      `hay un objeto en ${path} y otro en ${previo.path_cuarentena}. ` +
        "El movimiento quedó a medias de una forma que este script no puede resolver solo: " +
        "compara los dos a mano antes de tocar nada.",
    );
  }
  if (!enOrigen && !enDestino) {
    morir(
      `no hay objeto ni en ${path} ni en ${previo.path_cuarentena}. ` +
        "El retiro está registrado pero el documento no aparece: esto se revisa a mano, " +
        "y el retiro sin sellar es la evidencia de que algo pasó aquí.",
    );
  }

  if (enOrigen) {
    const { error } = await admin.storage.from(BUCKET).move(path, previo.path_cuarentena);
    if (error) {
      morir(
        `el retiro sigue registrado (${previo.id}) pero el objeto NO se movió: ${error.message}. ` +
          "Vuelve a correr el mismo comando.",
      );
    }
  } else {
    console.log("  el objeto ya estaba en cuarentena de una corrida anterior. Sólo falta el sello.");
  }

  await sellar(previo.id);
  await comprobarYCerrar(previo.id, previo.path_cuarentena);
}

// 3. Retiro nuevo. Aquí sí, el objeto tiene que estar donde dice: si no, o ya
// se retiró y no quedó bitácora, o la ruta está mal escrita, y en los dos casos
// lo que no se vale es inventar un registro.
if (!(await existeObjeto(path))) morir(`no existe el objeto ${path} en el bucket ${BUCKET}.`);

const { data: documento } = await admin
  .from("documentos_clinicos")
  .select("id")
  .eq("path", path)
  .maybeSingle();
if (!documento) {
  console.log("  aviso       el objeto no tiene fila en documentos_clinicos (huérfano). Se retira igual.");
}

let ejecutadoPor = null;
if (ejecutor) {
  const { data: usuario } = await admin
    .from("usuarios")
    .select("id")
    .eq("email", ejecutor)
    .maybeSingle();
  if (!usuario) morir(`no hay ningún usuario con el correo ${ejecutor}.`);
  ejecutadoPor = usuario.id;
}

const retiroId = crypto.randomUUID();
const destino = `cuarentena/${retiroId}/${path.split("/").pop()}`;

const { error: eRegistrar } = await admin.from("retiros_clinicos").insert({
  id: retiroId,
  documento_id: documento?.id ?? null,
  path_original: path,
  path_cuarentena: destino,
  motivo: motivo.trim(),
  responsable: responsable.trim(),
  ejecutado_por: ejecutadoPor,
});
if (eRegistrar) morir(`no se pudo registrar el retiro: ${eRegistrar.message}`);
console.log(`  registrado  retiro ${retiroId}`);

const { error: eMover } = await admin.storage.from(BUCKET).move(path, destino);
if (eMover) {
  morir(
    `el retiro quedó registrado (${retiroId}) pero el objeto NO se movió: ${eMover.message}. ` +
      "Vuelve a correr el mismo comando: retoma este retiro en vez de abrir otro.",
  );
}

await sellar(retiroId);
await comprobarYCerrar(retiroId, destino);

// Comprobación final contra la base, no contra lo que devolvieron las llamadas.
async function comprobarYCerrar(id, rutaCuarentena) {
  if (await existeObjeto(path)) morir("el objeto sigue en su ruta original. Revisa a mano antes de repetir.");
  if (!(await existeObjeto(rutaCuarentena))) {
    morir("el objeto no aparece en cuarentena. Revisa a mano antes de repetir.");
  }

  console.log("\nRetiro completado.");
  console.log(`  el objeto vive en ${rutaCuarentena}, que ningún rol de la aplicación alcanza.`);
  console.log("  la fila de documentos_clinicos no se tocó: sigue siendo el rastro de que existió.");
  console.log(`  la bitácora del retiro es ${id} en retiros_clinicos, y ya no admite cambios.`);
  process.exit(0);
}
