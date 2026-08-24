// Comprobación previa para la máquina del tester.
//
// El workflow `fed004a-rls.yml` ya se niega a correr si hay un vínculo remoto,
// un archivo de entorno o un token de Supabase. Ese candado vive en la
// integración continua y no protege la máquina donde el tester de verdad
// trabaja, que es donde están las credenciales reales y donde una variable
// heredada de otra terminal alcanza al proyecto de la doctora.
//
// Esto es el mismo preflight, ejecutable localmente:
//   node scripts/preflight-tester.mjs
//
// No modifica nada. Sale con 0 si el entorno es seguro para pruebas y con 1 si
// encuentra un camino hacia producción.

import { existsSync, readFileSync } from "node:fs";
import { esSupabaseLocal } from "./guardia-supabase.mjs";

const problemas = [];
const avisos = [];
const ok = [];

// 1. Vínculo del CLI de Supabase a un proyecto remoto.
const refPath = "supabase/.temp/project-ref";
if (existsSync(refPath)) {
  const ref = readFileSync(refPath, "utf8").trim();
  problemas.push(
    `Hay un vínculo a un proyecto remoto en ${refPath} (${ref}). ` +
      `Con ese vínculo, "supabase db push" y "supabase db reset --linked" alcanzan ese proyecto. ` +
      `Ejecuta "supabase unlink" antes de probar.`,
  );
} else {
  ok.push("No hay vínculo a ningún proyecto remoto de Supabase.");
}

// 2. Archivos de entorno con credenciales.
const envs = [".env", ".env.local", ".env.production", ".env.development.local"].filter(existsSync);
if (envs.length > 0) {
  problemas.push(
    `Existen archivos de entorno: ${envs.join(", ")}. ` +
      `"next dev" los carga automáticamente, así que la aplicación que abra el tester puede estar hablando con producción ` +
      `aunque las pruebas apunten al Supabase local. Muévelos fuera del repositorio mientras dure la prueba.`,
  );
} else {
  ok.push("No hay archivos de entorno en el repositorio.");
}

// 3. Token de acceso de Supabase en el ambiente.
if (process.env.SUPABASE_ACCESS_TOKEN) {
  problemas.push(
    "SUPABASE_ACCESS_TOKEN está definido en este ambiente. Es la credencial que permite " +
      "operar proyectos remotos desde el CLI. Quítala de la terminal antes de probar.",
  );
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
  if (esSupabaseLocal(v)) ok.push(`${nombre} apunta a un Supabase local (${v}).`);
  else problemas.push(`${nombre} apunta a "${v}", que NO es local. Esa variable alcanza datos reales.`);
}

// 5. Token de despliegue de Vercel. H-001 lo da por quemado y sin rotar.
if (process.env.VERCEL_TOKEN) {
  problemas.push(
    "VERCEL_TOKEN está definido. H-001 declara ese token quemado y pendiente de rotación (FED-003). " +
      "Una prueba no necesita poder desplegar.",
  );
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

console.log("\nPreflight aprobado: no se encontró ningún camino hacia el Supabase de la doctora.");
