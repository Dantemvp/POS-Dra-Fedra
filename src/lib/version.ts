export type VersionApp = {
  version: string;
  commit: string;
  etiqueta: string;
};

export function formatearVersion(version: string, commit: string): VersionApp {
  const versionLimpia = version.trim() || "sin-versión";
  const commitLimpio = commit.trim().slice(0, 7) || "local";
  return {
    version: versionLimpia,
    commit: commitLimpio,
    etiqueta: `v${versionLimpia} · ${commitLimpio}`,
  };
}

export const APP_VERSION = formatearVersion(
  process.env.NEXT_PUBLIC_APP_VERSION ?? "sin-versión",
  process.env.NEXT_PUBLIC_APP_COMMIT ?? "local",
);
