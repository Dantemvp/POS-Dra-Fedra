import type { NextConfig } from "next";
import packageJson from "./package.json";

const vercelCommit = process.env.VERCEL_GIT_COMMIT_SHA;
const esProduccionVercel = process.env.VERCEL_ENV === "production";

if (esProduccionVercel && !vercelCommit) {
  throw new Error(
    "Build de producción bloqueado: falta VERCEL_GIT_COMMIT_SHA.",
  );
}
if (esProduccionVercel && packageJson.version.includes("-")) {
  throw new Error(
    `Build de producción bloqueado: ${packageJson.version} es una versión preliminar.`,
  );
}

const commit = vercelCommit ?? process.env.GITHUB_SHA ?? "local";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
    NEXT_PUBLIC_APP_COMMIT: commit.slice(0, 7),
  },
  async headers() {
    return [
      {
        // El service worker no debe cachearse: que el cel siempre tome la última versión.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
