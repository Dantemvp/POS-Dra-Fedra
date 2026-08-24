// Somete la guarda anti-producción a casos adversarios. Corre en integración
// continua, sin base de datos y sin credenciales.
//
// Un candado sin prueba es la versión en seguridad del typecheck con `|| echo`
// que en Bianca dejó pasar dos pantallas en blanco: se ve, tranquiliza y no
// puede fallar. Este archivo existe para que sí pueda.
//
// La regla que importa es asimétrica. Rechazar un local legítimo estorba;
// aceptar un remoto toca el expediente de una paciente. Por eso sólo las
// desviaciones PERMISIVAS son fatales.

import { esSupabaseLocal } from "./guardia-supabase.mjs";

/** [url, debeAceptarse, nota] */
const CASOS = [
  ["http://127.0.0.1:54321", true, "local canónico del CLI"],
  ["http://localhost:54321", true, "localhost con puerto"],
  ["http://127.0.0.1", true, "sin puerto"],
  ["http://0.0.0.0:54321", true, "todas las interfaces"],
  ["http://127.0.0.1:54321/", true, "una barra final"],
  ["https://kxtznwgdpvbtlsedmjap.supabase.co", false, "PRODUCCIÓN de la doctora"],
  ["https://cualquier-otro.supabase.co", false, "cualquier proyecto remoto"],
  ["https://sistema-fedra.vercel.app", false, "el despliegue productivo"],
  ["http://127.0.0.1.evil.com", false, "sufijo engañoso sobre la IP"],
  ["http://localhost.evil.com", false, "sufijo engañoso sobre localhost"],
  ["http://127.0.0.1@evil.com", false, "userinfo antes del host real"],
  ["http://localhost@kxtznwgdpvbtlsedmjap.supabase.co", false, "userinfo hacia producción"],
  ["http://evil.com#http://127.0.0.1", false, "local dentro del fragmento"],
  ["http://evil.com/?u=http://localhost", false, "local dentro de la query"],
  ["http://127.0.0.1:54321/rest/v1", false, "con ruta: falla cerrado"],
  ["HTTP://127.0.0.1:54321", false, "esquema en mayúsculas: falla cerrado"],
  ["http://LOCALHOST:54321", false, "host en mayúsculas: falla cerrado"],
  ["http://[::1]:54321", false, "loopback IPv6: falla cerrado"],
  ["http://127.0.0.2:54321", false, "otro loopback: falla cerrado"],
  ["http://127.1:54321", false, "IP en forma corta: falla cerrado"],
  ["http://0177.0.0.1:54321", false, "IP en octal: falla cerrado"],
  ["http://2130706433:54321", false, "IP en decimal: falla cerrado"],
  ["  http://127.0.0.1:54321  ", false, "con espacios: falla cerrado"],
  ["http://127.0.0.1:54321\n", false, "con salto de línea: falla cerrado"],
  ["", false, "cadena vacía"],
  [null, false, "nulo"],
  [undefined, false, "indefinido"],
  ["127.0.0.1:54321", false, "sin esquema"],
];

const permisivas = [];
const estrictas = [];

for (const [url, debe, nota] of CASOS) {
  const got = esSupabaseLocal(url);
  if (got === debe) continue;
  (got ? permisivas : estrictas).push(`${JSON.stringify(url)} (${nota})`);
}

if (estrictas.length > 0) {
  console.log(`Aviso: ${estrictas.length} caso(s) rechazados de más (no es un riesgo):`);
  for (const c of estrictas) console.log(`- ${c}`);
}

if (permisivas.length > 0) {
  console.error("Guarda anti-producción FALLIDA. Acepta URLs que no son locales:");
  for (const c of permisivas) console.error(`- ${c}`);
  process.exit(1);
}

console.log(
  `Guarda anti-producción válida: ${CASOS.length} casos, ` +
    `${CASOS.filter(([, d]) => d).length} aceptados y ${CASOS.filter(([, d]) => !d).length} rechazados, ` +
    `0 desviaciones permisivas.`,
);
