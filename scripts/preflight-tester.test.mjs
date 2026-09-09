import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";

const SCRIPT = join(process.cwd(), "scripts", "preflight-tester.mjs");
const TESTER_REF = "mvevriyiyuurjmwileoh";
const TESTER_URL = `https://${TESTER_REF}.supabase.co`;
const temporales = [];

function ejecutar(archivos) {
  const directorio = mkdtempSync(join(tmpdir(), "fedra-preflight-"));
  temporales.push(directorio);
  mkdirSync(join(directorio, "supabase", ".temp"), { recursive: true });
  writeFileSync(join(directorio, "supabase", ".temp", "project-ref"), TESTER_REF);
  for (const [nombre, contenido] of Object.entries(archivos)) {
    writeFileSync(join(directorio, nombre), contenido);
  }

  const env = { ...process.env };
  delete env.SUPABASE_URL;
  delete env.NEXT_PUBLIC_SUPABASE_URL;
  delete env.SUPABASE_ACCESS_TOKEN;
  delete env.VERCEL_TOKEN;

  return spawnSync(process.execPath, [SCRIPT, "--remoto"], {
    cwd: directorio,
    env,
    encoding: "utf8",
  });
}

afterEach(() => {
  for (const directorio of temporales.splice(0)) {
    rmSync(directorio, { recursive: true, force: true });
  }
});

describe("preflight remoto del tester", () => {
  it("falla si existe un env pero no puede demostrar el destino de la aplicación", () => {
    const resultado = ejecutar({ ".env.local": 'NEXT_PUBLIC_SUPABASE_URL=""\n' });

    assert.equal(resultado.status, 1);
    assert.match(resultado.stderr, /No se puede demostrar que la aplicación apunte/);
  });

  it("detecta una URL productiva declarada en .env.development", () => {
    const resultado = ejecutar({
      ".env.development": "NEXT_PUBLIC_SUPABASE_URL=https://kxtznwgdpvbtlsedmjap.supabase.co\n",
    });

    assert.equal(resultado.status, 1);
    assert.match(resultado.stderr, /\.env\.development declara NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("aprueba cuando .env.development demuestra el tester autorizado", () => {
    const resultado = ejecutar({
      ".env.development": `NEXT_PUBLIC_SUPABASE_URL=${TESTER_URL}\n`,
    });

    assert.equal(resultado.status, 0);
    assert.match(resultado.stdout, new RegExp(`el destino comprobado es ${TESTER_REF}`));
  });
});
