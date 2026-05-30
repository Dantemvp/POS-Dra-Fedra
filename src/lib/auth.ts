import { createClient } from "@/lib/supabase/server";

export type Rol = "admin" | "farmacia" | "doctora" | "asistente";

export type UsuarioActual = {
  authUid: string;
  email: string;
  nombre: string;
  rol: Rol;
};

// Devuelve el usuario autenticado + su fila en `usuarios` (rol incluido).
// null si no hay sesión.
export async function getUsuarioActual(): Promise<UsuarioActual | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: fila } = await supabase
    .from("usuarios")
    .select("nombre, email, rol")
    .eq("auth_uid", user.id)
    .single();

  return {
    authUid: user.id,
    email: fila?.email ?? user.email ?? "",
    nombre: fila?.nombre ?? user.email ?? "Usuario",
    rol: (fila?.rol as Rol) ?? "asistente",
  };
}
