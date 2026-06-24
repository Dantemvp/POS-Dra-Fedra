import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Roles permitidos por prefijo de ruta. Si una ruta protegida no aparece aquí,
// queda permitida para cualquier usuario autenticado (ej. /dashboard).
const RUTAS_ROL: { prefijo: string; roles: string[] }[] = [
  { prefijo: "/inventario", roles: ["admin", "farmacia", "gerente"] },
  { prefijo: "/compras", roles: ["admin", "farmacia", "gerente"] },
  { prefijo: "/ventas", roles: ["admin", "farmacia", "gerente"] },
  { prefijo: "/caja", roles: ["admin", "farmacia", "gerente"] },
  { prefijo: "/pacientes", roles: ["admin", "doctora", "asistente", "gerente"] },
  { prefijo: "/agenda", roles: ["admin", "doctora", "asistente", "gerente"] },
  { prefijo: "/recetas", roles: ["admin", "doctora", "gerente"] },
  { prefijo: "/cobros", roles: ["admin", "doctora", "asistente", "gerente"] },
  { prefijo: "/servicios", roles: ["admin", "doctora", "gerente"] },
  { prefijo: "/movimientos", roles: ["admin", "doctora"] },
  { prefijo: "/usuarios", roles: ["admin"] },
];

// Refresca la sesión y protege rutas. Redirige a /login si no hay usuario.
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  // Rutas públicas: login/auth, los crons (se autentican con CRON_SECRET dentro
  // del handler), y los archivos del PWA (service worker + manifiesto), que el
  // navegador debe poder descargar sin sesión.
  const isPublic =
    path.startsWith("/login") ||
    path.startsWith("/auth") ||
    path.startsWith("/api/cron") ||
    path === "/sw.js" ||
    path === "/manifest.webmanifest";

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Control de acceso por rol: si la ruta exige roles y el usuario no los tiene,
  // lo mandamos al dashboard (no debe ver módulos de otra área).
  if (user) {
    const regla = RUTAS_ROL.find((r) => path.startsWith(r.prefijo));
    if (regla) {
      const { data: fila } = await supabase
        .from("usuarios")
        .select("rol")
        .eq("auth_uid", user.id)
        .single();
      const rol = fila?.rol as string | undefined;
      if (!rol || !regla.roles.includes(rol)) {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}
