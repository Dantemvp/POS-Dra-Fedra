import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const lock = JSON.parse(
  readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"),
);
const changelog = readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8");
const semver = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

if (!semver.test(pkg.version)) {
  throw new Error(`Versión inválida en package.json: ${pkg.version}`);
}
if (pkg.name !== lock.name || pkg.version !== lock.version) {
  throw new Error("package.json y package-lock.json no tienen el mismo nombre y versión.");
}
if (lock.packages?.[""]?.version !== pkg.version) {
  throw new Error("La raíz de package-lock.json no coincide con package.json.");
}

if (process.env.GITHUB_REF_TYPE === "tag") {
  const esperado = `v${pkg.version}`;
  if (process.env.GITHUB_REF_NAME !== esperado) {
    throw new Error(`El tag debe ser ${esperado}, no ${process.env.GITHUB_REF_NAME}.`);
  }
  if (pkg.version.includes("-")) {
    throw new Error("Una versión preliminar no se puede marcar como liberación estable.");
  }
  if (!changelog.includes(`## [${pkg.version}]`)) {
    throw new Error(`CHANGELOG.md no contiene el encabezado ## [${pkg.version}].`);
  }
}

console.log(`Versión válida: ${pkg.name}@${pkg.version}`);
