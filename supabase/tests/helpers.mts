import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { exigirSupabaseLocal, requerido } from "../../scripts/guardia-supabase.mjs";

// Estas pruebas hablan con Supabase como lo haría un extraño: por la API, con
// la llave anónima y una sesión real por rol. No leen los archivos de
// migración. Si una política concede de más, la prueba lo ve.

export const ROLES = ["admin", "doctora", "farmacia", "asistente", "gerente"] as const;
export type Rol = (typeof ROLES)[number];

const PASSWORD = "Prueba-FED004A!";

// La guarda vive en un solo archivo, `scripts/guardia-supabase.mjs`, y
// `scripts/check-guardia.mjs` la somete a casos adversarios en cada corrida de
// integración continua. Antes esta expresión estaba copiada aquí y en
// `preparar-storage.mjs`: dos copias que podían divergir y ningún caso que las
// probara.
const CONTEXTO = "FED-004A (pruebas de políticas)";

export const API_URL = exigirSupabaseLocal(
  requerido("SUPABASE_URL", CONTEXTO),
  CONTEXTO,
);
export const ANON_KEY = requerido("SUPABASE_ANON_KEY", CONTEXTO);

export function clienteAnonimo(): SupabaseClient {
  return createClient(API_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function sesion(rol: Rol): Promise<SupabaseClient> {
  const cliente = clienteAnonimo();
  const { error } = await cliente.auth.signInWithPassword({
    email: `${rol}@fedra.test`,
    password: PASSWORD,
  });
  if (error) {
    throw new Error(`No se pudo iniciar sesión como ${rol}: ${error.message}`);
  }
  return cliente;
}

// Cuántas filas ve esta sesión en una tabla.
//
// RLS no devuelve error cuando niega la lectura: devuelve cero filas. Por eso
// se cuenta en vez de atrapar. Pero un error SÍ importa: si faltara un GRANT,
// la consulta fallaría y devolver cero haría que estas pruebas pasaran por la
// razón equivocada, midiendo permisos de tabla en vez de políticas.
export async function filasVisibles(cliente: SupabaseClient, tabla: string): Promise<number> {
  const { count, error } = await cliente.from(tabla).select("*", { count: "exact", head: true });
  if (error) {
    throw new Error(
      `Consultar "${tabla}" falló con "${error.message}". Eso no es RLS negando: ` +
        `es un error de la consulta, y dejaría estas pruebas verdes sin haber probado nada.`,
    );
  }
  return count ?? 0;
}
