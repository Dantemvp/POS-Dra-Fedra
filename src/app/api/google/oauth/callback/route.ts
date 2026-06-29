import { NextRequest, NextResponse } from "next/server";
import { getUsuarioActual } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

// Regreso del consentimiento de Google: intercambia el código por tokens y
// guarda la conexión única del consultorio. Solo admin/doctora.
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = req.cookies.get("gcal_state")?.value;

  const fail = (motivo: string) =>
    NextResponse.redirect(new URL(`/agenda?gcal=${motivo}`, req.url));

  if (url.searchParams.get("error")) return fail("cancelado");
  if (!code || !state || !cookieState || state !== cookieState)
    return fail("error");

  const u = await getUsuarioActual();
  if (!u || (u.rol !== "admin" && u.rol !== "doctora")) return fail("denegado");

  const redirectUri = new URL(
    "/api/google/oauth/callback",
    url.origin,
  ).toString();

  try {
    // 1) Intercambiar código por tokens.
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
        client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });
    if (!tokenRes.ok) {
      console.error("[gcal] token exchange", tokenRes.status, await tokenRes.text());
      return fail("error");
    }
    const tok = (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };
    if (!tok.refresh_token) {
      // Sin refresh_token no podemos mantener la conexión; pasa si el usuario ya
      // había autorizado antes. prompt=consent debería evitarlo.
      return fail("sinrefresh");
    }

    // 2) Email de la cuenta conectada (solo para mostrarlo).
    let email: string | null = null;
    try {
      const ui = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tok.access_token}` },
      });
      if (ui.ok) email = ((await ui.json()) as { email?: string }).email ?? null;
    } catch {
      /* no es crítico */
    }

    // 3) id de usuario (usuarios.id) para registrar quién conectó.
    const admin = createAdminClient();
    const { data: fila } = await admin
      .from("usuarios")
      .select("id")
      .eq("auth_uid", u.authUid)
      .single();

    const expiry = new Date(Date.now() + tok.expires_in * 1000).toISOString();

    // 4) Guardar la conexión única (id=true). Upsert para reconexión.
    const { error } = await admin.from("google_calendar_conexion").upsert({
      id: true,
      access_token: tok.access_token,
      refresh_token: tok.refresh_token,
      expiry,
      calendar_id: "primary",
      email,
      conectado_por: fila?.id ?? null,
      actualizado_en: expiry,
    });
    if (error) {
      console.error("[gcal] guardar conexión", error);
      return fail("error");
    }

    return NextResponse.redirect(new URL("/agenda?gcal=conectado", req.url));
  } catch (e) {
    console.error("[gcal] callback excepción", e);
    return fail("error");
  }
}
