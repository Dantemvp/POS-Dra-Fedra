"use server";

import { createClient } from "@/lib/supabase/server";
import { enviarAUsuario } from "@/lib/push";
import { mensajePush } from "@/lib/push-resultado";

export type Result = { ok: boolean; error?: string };

type SubJSON = {
  endpoint: string;
  keys?: { p256dh?: string; auth?: string };
};

// Guarda (o actualiza) la suscripción del dispositivo actual para el usuario en sesión.
export async function guardarSuscripcion(
  sub: SubJSON,
  userAgent?: string,
): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sin sesión." };
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth)
    return { ok: false, error: "Suscripción inválida." };

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        auth_uid: user.id,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        user_agent: userAgent ?? null,
        usado_en: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Elimina la suscripción de este dispositivo (al desactivar las notificaciones).
export async function eliminarSuscripcion(endpoint: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Manda una notificación de prueba a los dispositivos del usuario actual.
export async function enviarPrueba(): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sin sesión." };

  const resultado = await enviarAUsuario(user.id, {
    title: "Notificación de prueba ✅",
    body: "Tus notificaciones del Sistema Fedra están funcionando.",
    url: "/notificaciones",
    tag: "prueba",
  });
  if (resultado.enviadas === 0) return { ok: false, error: mensajePush(resultado) };
  return { ok: true };
}
