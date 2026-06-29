import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Cliente mínimo de Google Calendar para sincronizar la agenda (POS -> Calendar).
// Filosofía: NUNCA romper la operación. Si Google falla o no hay conexión, las
// funciones devuelven null y registran el error; la cita ya quedó guardada en
// nuestra base pase lo que pase.

const SCOPE = "https://www.googleapis.com/auth/calendar.events";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DURACION_MIN = 30; // duración por defecto del evento

export { SCOPE };

type Conexion = {
  access_token: string | null;
  refresh_token: string;
  expiry: string | null;
  calendar_id: string;
  email: string | null;
};

export function googleConfigurado(): boolean {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  );
}

async function getConexion(): Promise<Conexion | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("google_calendar_conexion")
      .select("access_token, refresh_token, expiry, calendar_id, email")
      .eq("id", true)
      .maybeSingle();
    return (data as Conexion) ?? null;
  } catch (e) {
    console.error("[gcal] getConexion", e);
    return null;
  }
}

// Estado para la UI: solo si está conectado y con qué cuenta (nunca tokens).
export async function estadoConexion(): Promise<{
  conectado: boolean;
  email: string | null;
}> {
  const c = await getConexion();
  return { conectado: Boolean(c), email: c?.email ?? null };
}

// Devuelve un access_token válido, refrescándolo si ya caducó. null si no hay
// conexión o si el refresh falla (p. ej. permiso revocado).
async function getAccessTokenValido(): Promise<{
  token: string;
  calendarId: string;
} | null> {
  const c = await getConexion();
  if (!c) return null;

  const margen = 60_000; // refrescar 1 min antes de caducar
  const vigente =
    c.access_token && c.expiry && new Date(c.expiry).getTime() - margen > Date.now();
  if (vigente) return { token: c.access_token!, calendarId: c.calendar_id };

  // Refrescar con el refresh_token.
  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
        client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
        refresh_token: c.refresh_token,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) {
      console.error("[gcal] refresh falló", res.status, await res.text());
      return null;
    }
    const tok = (await res.json()) as { access_token: string; expires_in: number };
    const expiry = new Date(Date.now() + tok.expires_in * 1000).toISOString();
    const admin = createAdminClient();
    await admin
      .from("google_calendar_conexion")
      .update({ access_token: tok.access_token, expiry, actualizado_en: expiry })
      .eq("id", true);
    return { token: tok.access_token, calendarId: c.calendar_id };
  } catch (e) {
    console.error("[gcal] refresh excepción", e);
    return null;
  }
}

export type EventoCita = {
  titulo: string;
  inicioISO: string; // instante con offset, ej. 2026-06-28T15:00:00-07:00
  descripcion?: string | null;
};

function cuerpoEvento(ev: EventoCita) {
  const fin = new Date(new Date(ev.inicioISO).getTime() + DURACION_MIN * 60_000);
  return {
    summary: ev.titulo,
    description: ev.descripcion ?? undefined,
    start: { dateTime: ev.inicioISO },
    end: { dateTime: fin.toISOString() },
  };
}

// Crea el evento y devuelve su id de Google (o null si no se pudo).
export async function crearEvento(ev: EventoCita): Promise<string | null> {
  const auth = await getAccessTokenValido();
  if (!auth) return null;
  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        auth.calendarId,
      )}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(cuerpoEvento(ev)),
      },
    );
    if (!res.ok) {
      console.error("[gcal] crearEvento", res.status, await res.text());
      return null;
    }
    const data = (await res.json()) as { id: string };
    return data.id;
  } catch (e) {
    console.error("[gcal] crearEvento excepción", e);
    return null;
  }
}

export async function actualizarEvento(
  eventId: string,
  ev: EventoCita,
): Promise<boolean> {
  const auth = await getAccessTokenValido();
  if (!auth) return false;
  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        auth.calendarId,
      )}/events/${encodeURIComponent(eventId)}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${auth.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(cuerpoEvento(ev)),
      },
    );
    if (!res.ok) console.error("[gcal] actualizarEvento", res.status);
    return res.ok;
  } catch (e) {
    console.error("[gcal] actualizarEvento excepción", e);
    return false;
  }
}

export async function borrarEvento(eventId: string): Promise<boolean> {
  const auth = await getAccessTokenValido();
  if (!auth) return false;
  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        auth.calendarId,
      )}/events/${encodeURIComponent(eventId)}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${auth.token}` } },
    );
    // 410 = ya estaba borrado; lo tratamos como éxito.
    return res.ok || res.status === 410;
  } catch (e) {
    console.error("[gcal] borrarEvento excepción", e);
    return false;
  }
}
