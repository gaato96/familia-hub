import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

/**
 * Service role: SALTEA RLS por completo.
 *
 * Se usa solo donde RLS genuinamente no llega: mandar Web Push a otros
 * integrantes, y los jobs de cron que corren sin sesión. Todo call site tiene
 * que validar antes la sesión y la pertenencia a la familia del que llama —
 * ver src/lib/push/send.ts para el patrón.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY");

  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
