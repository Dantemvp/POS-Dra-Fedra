"use server";

import { revalidatePath } from "next/cache";
import { getUsuarioActual } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export type Result = { ok: boolean; error?: string };

const ROLES = ["admin", "doctora", "asistente", "farmacia"] as const;
type Rol = (typeof ROLES)[number];

async function exigirAdmin(): Promise<Result | null> {
  const u = await getUsuarioActual();
  if (u?.rol !== "admin")
    return { ok: false, error: "Solo el administrador puede gestionar usuarios." };
  return null;
}

function validarPassword(p: string): string | null {
  if (p.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
  return null;
}

// Crear empleada: el admin define la contraseña (la conoce y la comparte).
export async function crearUsuario(
  _prev: Result,
  formData: FormData,
): Promise<Result> {
  const no = await exigirAdmin();
  if (no) return no;

  const nombre = String(formData.get("nombre") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const rol = String(formData.get("rol") ?? "asistente") as Rol;

  if (!nombre) return { ok: false, error: "Escribe el nombre." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return { ok: false, error: "Correo no válido." };
  const errPwd = validarPassword(password);
  if (errPwd) return { ok: false, error: errPwd };
  if (!ROLES.includes(rol)) return { ok: false, error: "Rol no válido." };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre },
  });
  if (error) return { ok: false, error: error.message };

  // El trigger crea el perfil (rol asistente por defecto). Fijamos nombre + rol.
  const { error: e2 } = await admin
    .from("usuarios")
    .upsert(
      { auth_uid: data.user!.id, email, nombre, rol, activo: true },
      { onConflict: "auth_uid" },
    );
  if (e2) return { ok: false, error: e2.message };

  revalidatePath("/usuarios");
  return { ok: true };
}

// Resetear contraseña a un valor que el admin define (y comparte).
export async function resetearPassword(
  authUid: string,
  nueva: string,
): Promise<Result> {
  const no = await exigirAdmin();
  if (no) return no;
  if (!authUid) return { ok: false, error: "Usuario no válido." };
  const errPwd = validarPassword(nueva);
  if (errPwd) return { ok: false, error: errPwd };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(authUid, {
    password: nueva,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Cambiar rol.
export async function cambiarRol(
  usuarioId: string,
  rol: string,
): Promise<Result> {
  const no = await exigirAdmin();
  if (no) return no;
  if (!ROLES.includes(rol as Rol))
    return { ok: false, error: "Rol no válido." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("usuarios")
    .update({ rol })
    .eq("id", usuarioId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/usuarios");
  return { ok: true };
}

// Activar / desactivar. Al desactivar también se bloquea el acceso (ban).
export async function toggleActivo(
  usuarioId: string,
  authUid: string,
  activo: boolean,
): Promise<Result> {
  const no = await exigirAdmin();
  if (no) return no;

  const yo = await getUsuarioActual();
  if (yo?.authUid === authUid)
    return { ok: false, error: "No puedes desactivar tu propia cuenta." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("usuarios")
    .update({ activo })
    .eq("id", usuarioId);
  if (error) return { ok: false, error: error.message };

  // Bloquear/desbloquear el login en Supabase Auth.
  if (authUid) {
    await admin.auth.admin.updateUserById(authUid, {
      ban_duration: activo ? "none" : "876000h", // ~100 años
    });
  }
  revalidatePath("/usuarios");
  return { ok: true };
}
