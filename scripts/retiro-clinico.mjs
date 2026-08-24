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
// medias y visible, en vez de un archivo desaparecido sin explicación. Volver a
// correrlo con la misma ruta retoma ese retiro en lugar de abrir otro.
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

// El objeto tiene que existir donde dice. Si no, o ya se retiró o la ruta está
// mal escrita, y en los dos casos lo que no se vale es inventar una bitácora.
const { data: bytes } = await admin.storage.from(BUCKET).download(path);
if (!bytes) morir(`no existe el objeto ${path} en el bucket ${BUCKET}.`);

const { data: documento } = await admin
  .from("documentos_clinicos")
  .select("id, paciente_id")
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

// ¿Quedó un retiro a medias de una corrida anterior? Se retoma ese, para no
// abrir dos bitácoras del mismo hecho.
const { data: pendiente } = await admin
  .from("retiros_clinicos")
  .select("id, path_cuarentena, movido_en")
  .eq("path_original", path)
  .is("movido_en", null)
  .maybeSingle();

let retiroId = pendiente?.id ?? null;
let destino = pendiente?.path_cuarentena ?? null;

if (pendiente) {
  console.log(`  retomando   retiro ${retiroId} que quedó sin sellar.`);
} else {
  retiroId = crypto.randomUUID();
  destino = `cuarentena/${retiroId}/${path.split("/").pop()}`;
  const { error } = await admin.from("retiros_clinicos").insert({
    id: retiroId,
    documento_id: documento?.id ?? null,
    path_original: path,
    path_cuarentena: destino,
    motivo: motivo.trim(),
    responsable: responsable.trim(),
    ejecutado_por: ejecutadoPor,
  });
  if (error) morir(`no se pudo registrar el retiro: ${error.message}`);
  console.log(`  registrado  retiro ${retiroId}`);
}

const { error: eMover } = await admin.storage.from(BUCKET).move(path, destino);
if (eMover) {
  morir(
    `el retiro quedó registrado (${retiroId}) pero el objeto NO se movió: ${eMover.message}. ` +
      "Vuelve a correr el mismo comando: retoma este retiro en vez de abrir otro.",
  );
}

const { error: eSello } = await admin
  .from("retiros_clinicos")
  .update({ movido_en: new Date().toISOString() })
  .eq("id", retiroId);
if (eSello) morir(`el objeto ya está en cuarentena pero no se pudo sellar el retiro: ${eSello.message}`);

// Comprobación final contra la base, no contra lo que devolvieron las llamadas.
const { data: enOrigen } = await admin.storage.from(BUCKET).download(path);
const { data: enCuarentena } = await admin.storage.from(BUCKET).download(destino);
if (enOrigen) morir("el objeto sigue en su ruta original. Revisa a mano antes de repetir.");
if (!enCuarentena) morir("el objeto no aparece en cuarentena. Revisa a mano antes de repetir.");

console.log("\nRetiro completado.");
console.log(`  el objeto vive en ${destino}, que ningún rol de la aplicación alcanza.`);
console.log(`  la fila de documentos_clinicos no se tocó: sigue siendo el rastro de que existió.`);
console.log(`  la bitácora del retiro es ${retiroId} en retiros_clinicos, y ya no admite cambios.`);
