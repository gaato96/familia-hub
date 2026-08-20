"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Crear familia y unirse a una familia, con el paso que se olvida siempre.
 *
 * Los claims `family_id` y `user_role` se estampan cuando se emite el token
 * (custom_access_token_hook). Justo después de la RPC, el token que el browser
 * tiene en la mano TODAVÍA dice que este usuario no tiene familia — así que la
 * primera lectura devolvería cero filas y la app parecería rota.
 *
 * `refreshSession()` fuerza un token nuevo y es lo que hace que RLS empiece a
 * dejar pasar. Sin esta línea todo compila, todo "anda", y la pantalla queda
 * vacía sin ningún error.
 */
async function refreshClaims() {
  const supabase = createClient();
  const { error } = await supabase.auth.refreshSession();
  if (error) throw error;
}

export async function createFamily(familyName: string, displayName: string) {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("create_family", {
    p_family_name: familyName,
    p_display_name: displayName,
  });
  if (error) throw error;

  await refreshClaims();
  return data;
}

export async function joinFamily(inviteCode: string, displayName: string) {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("join_family", {
    p_invite_code: inviteCode.trim().toUpperCase(),
    p_display_name: displayName,
  });
  if (error) throw error;

  await refreshClaims();
  return data;
}

/** Los `raise exception` del SQL vienen en castellano; el resto, no. */
export function onboardingMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);

  if (raw.includes("código no corresponde")) {
    return "Ese código no existe. Revisá que esté bien escrito.";
  }
  if (raw.includes("Ya pertenecés")) {
    return "Tu cuenta ya está en una familia.";
  }
  if (raw.toLowerCase().includes("fetch")) {
    return "Sin conexión. Revisá internet e intentá de nuevo.";
  }
  return "No se pudo completar. Intentá de nuevo.";
}
