import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Configuración aparte de la del proyecto. Estas pruebas necesitan un Supabase
// local levantado y no deben correr en la CI normal, donde no hay base.
export default defineConfig({
  root: fileURLToPath(new URL("../../", import.meta.url)),
  test: {
    environment: "node",
    include: ["supabase/tests/**/*.test.mts"],
    // Comparten una sola base: si corrieran en paralelo se pisarían.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
