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
  try {
    webpush.setVapidDetails("mailto:adantevele@gmail.com", pub, priv);
    configurado = true;
    return true;
  } catch {
    return false;
  }
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

export type PushResultado = {
  configurado: boolean;
  destinatarios: number;
  enviadas: number;
  expiradas: number;
  fallidas: number;
  motivo?: "sin_configuracion" | "sin_destinatarios" | "error_consulta" | "fallos_envio";
};

function sinEnvio(
  motivo: PushResultado["motivo"],
  destinatarios = 0,
): PushResultado {
  return {
    configurado: motivo !== "sin_configuracion",
    destinatarios,
    enviadas: 0,
    expiradas: 0,
    fallidas: 0,
    motivo,
  };
}

async function enviarASubs(subs: SubRow[], payload: Push): Promise<PushResultado> {
  if (!configurar()) return sinEnvio("sin_configuracion", subs.length);
  if (subs.length === 0) return sinEnvio("sin_destinatarios");
  const admin = createAdminClient();
  const cuerpo = JSON.stringify(payload);
  const muertas: string[] = [];
  let enviadas = 0;
  let fallidas = 0;

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
        else fallidas++;
      }
    }),
  );

  if (muertas.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", muertas);
  }
  return {
    configurado: true,
    destinatarios: subs.length,
    enviadas,
    expiradas: muertas.length,
    fallidas,
    motivo: fallidas > 0 || muertas.length > 0 ? "fallos_envio" : undefined,
  };
}

// Envía a TODOS los dispositivos de los usuarios con alguno de los roles dados.
export async function enviarARoles(roles: Rol[], payload: Push): Promise<PushResultado> {
  if (!configurar()) return sinEnvio("sin_configuracion");
  const admin = createAdminClient();
  const { data: usuarios, error: usuariosError } = await admin
    .from("usuarios")
    .select("auth_uid")
    .in("rol", roles)
    .eq("activo", true);
  if (usuariosError) return sinEnvio("error_consulta");
  const uids = (usuarios ?? [])
    .map((u) => u.auth_uid as string | null)
    .filter((x): x is string => !!x);
  if (uids.length === 0) return sinEnvio("sin_destinatarios");

  const { data: subs, error: subsError } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("auth_uid", uids);
  if (subsError) return sinEnvio("error_consulta");
  return enviarASubs((subs ?? []) as SubRow[], payload);
}

// Envía a los dispositivos de un usuario concreto (por su auth_uid).
export async function enviarAUsuario(authUid: string, payload: Push): Promise<PushResultado> {
  if (!configurar()) return sinEnvio("sin_configuracion");
  const admin = createAdminClient();
  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("auth_uid", authUid);
  if (error) return sinEnvio("error_consulta");
  return enviarASubs((subs ?? []) as SubRow[], payload);
}
