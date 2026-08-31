// Comprobación previa para dos operaciones distintas:
//   node scripts/preflight-tester.mjs           laboratorio Supabase local
//   node scripts/preflight-tester.mjs --remoto  tester remoto autorizado
//
// El workflow `fed004a-rls.yml` ya se niega a correr si hay un vínculo remoto,
// un archivo de entorno o un token de Supabase. Ese candado vive en la
// integración continua y no protege la máquina donde el tester de verdad
// trabaja, que es donde están las credenciales reales y donde una variable
// heredada de otra terminal alcanza al proyecto de la doctora.
//
// No modifica nada. Sale con 0 si el entorno es seguro para pruebas y con 1 si
// encuentra un camino hacia producción.

import { existsSync, readFileSync } from "node:fs";
import { esSupabaseLocal } from "./guardia-supabase.mjs";

const problemas = [];
const avisos = [];
const ok = [];
const remoto = process.argv.includes("--remoto");
const TESTER_REF = "mvevriyiyuurjmwileoh";
const TESTER_URL = `https://${TESTER_REF}.supabase.co`;

// 1. Vínculo del CLI de Supabase a un proyecto remoto.
const refPath = "supabase/.temp/project-ref";
if (existsSync(refPath)) {
  const ref = readFileSync(refPath, "utf8").trim();
  if (remoto && ref === TESTER_REF) {
    ok.push(`El CLI está enlazado al tester remoto autorizado (${ref}).`);
  } else {
    problemas.push(
      `Hay un vínculo remoto no permitido para este modo en ${refPath} (${ref}). ` +
        (remoto
          ? `El único destino permitido es ${TESTER_REF}.`
          : `Ejecuta "supabase unlink" antes de correr el laboratorio local.`),
    );
  }
} else {
  if (remoto) problemas.push(`Falta ${refPath}; no se puede demostrar que el destino sea ${TESTER_REF}.`);
  else ok.push("No hay vínculo a ningún proyecto remoto de Supabase.");
}

// 2. Archivos de entorno con credenciales.
//
// No basta con saber que existen: hay que leer a donde apuntan. El vinculo del
// CLI (`supabase/.temp/project-ref`) gobierna lo que hace `supabase`, pero la
// aplicacion que abre la persona que prueba no lee ese archivo: `next dev` lee
// el `.env.local`. Comprobar solo el vinculo aprueba un entorno donde el CLI
// mira al tester y el navegador mira a otra parte.
const ARCHIVOS_ENV = [".env", ".env.local", ".env.production", ".env.development.local"];
const CLAVES_URL = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"];

/** Lee las URLs de Supabase declaradas dentro de un archivo de entorno. */
function urlsDeclaradas(archivo) {
  const encontradas = [];
  for (const linea of readFileSync(archivo, "utf8").split(/\r?\n/)) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith("#")) continue;
    const sep = limpia.indexOf("=");
    if (sep < 0) continue;
    const clave = limpia.slice(0, sep).trim().replace(/^export\s+/, "");
    if (!CLAVES_URL.includes(clave)) continue;
    const valor = limpia.slice(sep + 1).trim().replace(/^["']|["']$/g, "");
    if (valor) encontradas.push([clave, valor]);
  }
  return encontradas;
}

const envs = ARCHIVOS_ENV.filter(existsSync);
if (envs.length > 0) {
  if (!remoto) {
    problemas.push(
      `Existen archivos de entorno: ${envs.join(", ")}. ` +
        `"next dev" puede cargarlos y alcanzar un proyecto remoto. Muévelos fuera del repositorio durante la prueba local.`,
    );
  }
  // En los dos modos se revisa el contenido, no solo la existencia.
  for (const archivo of envs) {
    const declaradas = urlsDeclaradas(archivo);
    if (declaradas.length === 0) {
      avisos.push(`${archivo} no declara ninguna URL de Supabase.`);
      continue;
    }
    for (const [clave, valor] of declaradas) {
      const limpia = valor.replace(/\/$/, "");
      const aceptada = remoto ? limpia === TESTER_URL : esSupabaseLocal(limpia);
      if (aceptada) {
        ok.push(`${archivo} declara ${clave} hacia el destino permitido.`);
      } else {
        problemas.push(
          `${archivo} declara ${clave}="${valor}", que no es el destino permitido en este modo. ` +
            `"next dev" lo carga solo, asi que el navegador hablaria con ese proyecto aunque el CLI apunte a otro. ` +
            (remoto ? `El unico destino permitido es ${TESTER_URL}.` : `Solo se acepta un Supabase local.`),
        );
      }
    }
  }
} else {
  ok.push("No hay archivos de entorno en el repositorio.");
}

// 3. Token de acceso de Supabase en el ambiente.
if (process.env.SUPABASE_ACCESS_TOKEN) {
  if (remoto) avisos.push("SUPABASE_ACCESS_TOKEN está definido; confirma la identidad del proyecto antes de cada escritura.");
  else problemas.push("SUPABASE_ACCESS_TOKEN está definido. Quítalo antes de correr el laboratorio local.");
} else {
  ok.push("SUPABASE_ACCESS_TOKEN no está definido.");
}

// 4. A dónde apuntan las variables que las pruebas y la aplicación van a usar.
for (const nombre of ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]) {
  const v = process.env[nombre];
  if (!v) {
    avisos.push(`${nombre} no está definida en esta terminal.`);
    continue;
  }
  if (remoto) {
    if (v.replace(/\/$/, "") === TESTER_URL) ok.push(`${nombre} apunta al tester remoto autorizado.`);
    else problemas.push(`${nombre} apunta a "${v}"; en modo remoto sólo se acepta ${TESTER_URL}.`);
  } else if (esSupabaseLocal(v)) ok.push(`${nombre} apunta a un Supabase local (${v}).`);
  else problemas.push(`${nombre} apunta a "${v}", que NO es local. Esa variable alcanza datos reales.`);
}

// 5. Token de despliegue de Vercel. H-001 lo da por quemado y sin rotar.
if (process.env.VERCEL_TOKEN) {
  if (remoto) avisos.push("VERCEL_TOKEN está definido; úsalo sólo con el proyecto fedra-pos-tester.");
  else problemas.push("VERCEL_TOKEN está definido. Una prueba local no necesita poder desplegar.");
} else {
  ok.push("VERCEL_TOKEN no está definido.");
}

for (const linea of ok) console.log(`  ok      ${linea}`);
for (const linea of avisos) console.log(`  aviso   ${linea}`);

if (problemas.length > 0) {
  console.error(`\nPreflight FALLIDO: ${problemas.length} camino(s) hacia producción.`);
  for (const p of problemas) console.error(`  - ${p}`);
  process.exit(1);
}

console.log(
  remoto
    ? `\nPreflight remoto aprobado: el destino comprobado es ${TESTER_REF}, no producción.`
    : "\nPreflight local aprobado: no se encontró ningún camino hacia un Supabase remoto.",
);
