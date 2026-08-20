import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Este archivo es el middleware del proyecto — Next 16 renombró el archivo, no
 * es una convención inventada acá.
 *
 * Refresca la sesión de Supabase en cada request y decide a qué pantalla
 * mandar a alguien. Es una capa de UX, NO la frontera de seguridad: eso es RLS.
 * Alguien que saltee esto no lee ni una fila, porque cada policy se apoya en
 * los claims del JWT.
 */

/** Rutas que se pueden ver sin sesión. */
const PUBLIC_PATHS = ["/ingresar", "/registro", "/offline"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getClaims() valida el token en vez de confiar en lo que diga la cookie, y
  // devuelve los claims propios (family_id, user_role) en un solo viaje.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims as
    | { sub?: string; user_role?: string; family_id?: string | null }
    | undefined;

  const { pathname } = request.nextUrl;
  const isSignedIn = Boolean(claims?.sub);
  const hasFamily = Boolean(claims?.family_id && claims?.user_role);

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    return NextResponse.redirect(url);
  };

  const isPublic =
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    // /unirse/[codigo] tiene que abrirse desde el link de invitación aunque no
    // haya sesión: la pantalla misma ofrece registrarse y guarda el código.
    pathname.startsWith("/unirse");

  if (!isSignedIn && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/ingresar";
    // Volver a donde quería ir después de entrar.
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  if (isSignedIn) {
    // Con sesión pero todavía sin familia: crear una o entrar con un código.
    // Es también donde cae un usuario desactivado, porque el hook le borra
    // los dos claims.
    if (!hasFamily && !isPublic && pathname !== "/bienvenida") {
      return redirectTo("/bienvenida");
    }
    if (hasFamily && pathname === "/bienvenida") {
      return redirectTo("/");
    }
    if (pathname === "/ingresar" || pathname === "/registro") {
      return redirectTo(hasFamily ? "/" : "/bienvenida");
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Todo menos assets estáticos y los archivos de la PWA. El service worker
     * en particular no puede pasar nunca por auth: una sesión vencida lo
     * convierte en un 307 donde el navegador esperaba JavaScript, y la
     * instalación se rompe sin ningún error visible.
     */
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff2?)$).*)",
  ],
};
