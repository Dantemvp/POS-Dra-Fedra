import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename, extname } from "node:path";

const extensionesTexto = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".sql",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);
const nombresTexto = new Set([".gitignore", ".npmrc"]);
const decoder = new TextDecoder("utf-8", { fatal: true });
const rutas = execFileSync("git", ["ls-files", "-z"])
  .toString("utf8")
  .split("\0")
  .filter(Boolean)
  .filter((ruta) =>
    extensionesTexto.has(extname(ruta).toLowerCase()) ||
    nombresTexto.has(basename(ruta)),
  );

const errores = [];
for (const ruta of rutas) {
  try {
    const texto = decoder.decode(readFileSync(ruta));
    if (texto.includes("\uFFFD")) errores.push(`${ruta}: contiene U+FFFD`);
  } catch {
    errores.push(`${ruta}: no es UTF-8 válido`);
  }
}

if (errores.length > 0) {
  console.error("Validación UTF-8 fallida:");
  for (const error of errores) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`UTF-8 válido en ${rutas.length} archivos de texto versionados.`);
