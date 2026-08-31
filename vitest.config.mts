import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Sin este alias, cualquier modulo que importe `@/lib/...` no se puede
      // probar. Por eso `push.ts`, que es donde vive la logica de entrega de
      // notificaciones, no tenia una sola prueba y solo se habia verificado a
      // mano en worktrees desechables.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` existe para reventar si un modulo de servidor se cuela al
      // paquete del navegador. En pruebas no hay paquete, y su condicion de
      // exportacion "browser" hace fallar la importacion bajo jsdom.
      "server-only": fileURLToPath(new URL("./src/test/stub-server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
  },
});
