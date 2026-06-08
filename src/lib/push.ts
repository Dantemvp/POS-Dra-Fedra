import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Rol } from "@/lib/auth";

// Configura VAPID una sola vez por proceso. Si faltan llaves, el envío se omite
// silenciosamente (la app sigue funcionando sin notificaciones).
let configurado = false;
function configurar(): boolean {
  if (configurado) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails("mailto:adantevele@gmail.com", pub, priv);
  configurado = true;
  return true;
}

export type Push = {
  title: string;
  body: string;
  url?: string; // a dónde lleva al tocarla (default /dashboard)
  tag?: string; // notificaciones con mismo tag se reemplazan en el cel
  icon?: string;
  requireInteraction?: boolean;
};

type SubRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

async function enviarASubs(subs: SubRow[], payload: Push): Promise<number> {
  if (!configurar() || subs.length === 0) return 0;
  const admin = createAdminClient();
  const cuerpo = JSON.stringify(payload);
  const muertas: string[] = [];
  let enviadas = 0;

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          cuerpo,
        );
        enviadas++;
      } catch (err: unknown) {
        // 404/410 = suscripción expirada o cancelada → la limpiamos.
        const code = (err as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) muertas.push(s.id);
      }
    }),
  );

  if (muertas.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", muertas);
  }
  return enviadas;
}

// Envía a TODOS los dispositivos de los usuarios con alguno de los roles dados.
export async function enviarARoles(roles: Rol[], payload: Push): Promise<number> {
  const admin = createAdminClient();
  const { data: usuarios } = await admin
    .from("usuarios")
    .select("auth_uid")
    .in("rol", roles)
    .eq("activo", true);
  const uids = (usuarios ?? [])
    .map((u) => u.auth_uid as string | null)
    .filter((x): x is string => !!x);
  if (uids.length === 0) return 0;

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("auth_uid", uids);
  return enviarASubs((subs ?? []) as SubRow[], payload);
}

// Envía a los dispositivos de un usuario concreto (por su auth_uid).
export async function enviarAUsuario(authUid: string, payload: Push): Promise<number> {
  const admin = createAdminClient();
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("auth_uid", authUid);
  return enviarASubs((subs ?? []) as SubRow[], payload);
}
