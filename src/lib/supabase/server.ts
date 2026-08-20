import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/types/database";

/**
 * Cliente atado a la sesión del usuario. Es el que se usa en el 99% de los
 * casos: RLS resuelve qué familia ve, así que las queries NUNCA filtran por
 * family_id a mano.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Un Server Component no puede escribir cookies. No es un error:
            // el refresh del token lo hace src/proxy.ts en cada request.
          }
        },
      },
    },
  );
}
