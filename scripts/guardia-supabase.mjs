// Única definición de "esta URL es un Supabase local y desechable".
//
// Antes esta expresión vivía copiada en `supabase/tests/helpers.mts` y en
// `supabase/tests/preparar-storage.mjs`. Dos copias de un candado son dos
// candados que pueden divergir, y un punto de entrada nuevo que olvide pegarla
// queda sin protección sin que nada avise. Aquí hay una sola, se importa, y
// `scripts/check-guardia.mjs` la somete a casos adversarios en cada corrida de
// integración continua.
//
// Criterio: falla cerrado. Cualquier forma que no sea exactamente
// `http(s)://{127.0.0.1|localhost|0.0.0.0}[:puerto]` se rechaza, incluidas las
// formas equivalentes a loopback (IPv6, decimal, octal, 127.0.0.2). Preferimos
// rechazar un local legítimo a aceptar un remoto disfrazado.

const LOCAL = /^https?:\/\/(127\.0\.0\.1|localhost|0\.0\.0\.0)(:\d+)?$/;

/** ¿La URL apunta a un Supabase local? */
export function esSupabaseLocal(url) {
  if (typeof url !== "string") return false;
  return LOCAL.test(url.replace(/\/$/, ""));
}

/**
 * Aborta si `url` no es local. `contexto` describe quién llamó, para que el
 * mensaje diga qué se detuvo y no solo que algo falló.
 */
export function exigirSupabaseLocal(url, contexto) {
  if (esSupabaseLocal(url)) return url;
  throw new Error(
    `${contexto}: SUPABASE_URL apunta a "${url}", que no es un Supabase local. ` +
      `Abortado para no tocar el proyecto de la doctora. ` +
      `Sólo se acepta http(s)://127.0.0.1|localhost|0.0.0.0 con puerto opcional.`,
  );
}

/** Lee una variable de entorno obligatoria. */
export function requerido(nombre, contexto) {
  const v = process.env[nombre];
  if (!v) throw new Error(`${contexto}: falta la variable ${nombre}.`);
  return v;
}
