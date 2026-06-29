import { NextRequest, NextResponse } from "next/server";
import { getUsuarioActual } from "@/lib/auth";
import { googleConfigurado } from "@/lib/google/calendar";

// Inicia el "Conectar con Google": redirige al consentimiento de Google.
// Solo admin/doctora pueden vincular el calendario del consultorio.
export async function GET(req: NextRequest) {
  const u = await getUsuarioActual();
  if (!u || (u.rol !== "admin" && u.rol !== "doctora")) {
    return NextResponse.redirect(new URL("/agenda?gcal=denegado", req.url));
  }
  if (!googleConfigurado()) {
    return NextResponse.redirect(new URL("/agenda?gcal=noconfig", req.url));
  }

  const redirectUri = new URL(
    "/api/google/oauth/callback",
    req.nextUrl.origin,
  ).toString();
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    // openid+email solo para mostrar "conectado como X"; calendar.events es el
    // permiso real (crear/editar/borrar eventos).
    scope: "openid email https://www.googleapis.com/auth/calendar.events",
    access_type: "offline", // pide refresh_token
    prompt: "consent", // fuerza que devuelva refresh_token siempre
    state,
  });

  const res = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  );
  // state anti-CSRF, validado en el callback.
  res.cookies.set("gcal_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
