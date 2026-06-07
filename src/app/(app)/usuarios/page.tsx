import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import UsuariosClient, { type UsuarioRow } from "./UsuariosClient";

export default async function UsuariosPage() {
  const yo = await getUsuarioActual();
  if (!yo) redirect("/login");
  if (yo.rol !== "admin") redirect("/dashboard");

  // Lista con service-role (incluye auth_uid para reset/ban).
  const admin = createAdminClient();
  const { data } = await admin
    .from("usuarios")
    .select("id, auth_uid, nombre, email, rol, activo, creado_en")
    .order("creado_en", { ascending: true });

  const usuarios = (data ?? []) as UsuarioRow[];

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-2xl font-semibold text-zinc-900">Usuarios</h1>
      <p className="mb-6 text-sm text-zinc-500">
        Da de alta al equipo, asígnales un rol y administra su acceso. Tú
        defines la contraseña y se la compartes; puedes resetearla cuando
        quieras.
      </p>
      <UsuariosClient usuarios={usuarios} miAuthUid={yo.authUid} />
    </div>
  );
}
