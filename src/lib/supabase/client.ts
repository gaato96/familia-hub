"use client";

import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/types/database";

let cached: ReturnType<typeof createBrowserClient<Database>> | undefined;

/**
 * Una sola instancia por pestaña: cada `createBrowserClient` abre su propio
 * canal de Realtime y su propio timer de refresh de token.
 */
export function createClient() {
  cached ??= createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return cached;
}
