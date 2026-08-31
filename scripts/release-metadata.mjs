import { execFileSync } from "node:child_process";

const ref = process.argv[2] ?? "HEAD";
if (!/^[0-9A-Za-z._\/-]+$/.test(ref)) {
  throw new Error(`Referencia Git inválida: ${ref}`);
}

const commit = execFileSync("git", ["rev-parse", ref], {
  encoding: "utf8",
}).trim();
const salida = execFileSync(
  "git",
  ["ls-tree", "-r", "--name-only", ref, "--", "supabase/migrations"],
  { encoding: "utf8" },
).trim();
const migraciones = salida ? salida.split(/\r?\n/).sort() : [];

console.log(
  JSON.stringify(
    {
      ref,
      commit,
      cantidad_migraciones: migraciones.length,
      ultima_migracion: migraciones.at(-1) ?? null,
      migraciones,
    },
    null,
    2,
  ),
);
