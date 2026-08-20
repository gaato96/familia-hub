import { cache } from "react";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { FamilyMemberRow, FamilyRow, UserRole } from "@/types/database";

export type FamilyContext = {
  userId: string;
  role: UserRole;
  family: FamilyRow;
  /** La ficha del que está mirando la pantalla. */
  member: FamilyMemberRow;
  /** Todos los integrantes, incluidos los que no tienen cuenta (Julián). */
  members: FamilyMemberRow[];
};

/**
 * Resuelve quién pregunta y a qué familia pertenece.
 *
 * Las queries de abajo NO filtran por family_id — lo hace RLS. Si las policies
 * están bien, esto devuelve exactamente una familia; si están mal,
 * tests/rls/isolation.test.ts falla mucho antes de que alguien vea la casa
 * de otro.
 *
 * Envuelto en `cache()` de React para que el layout y la página que va adentro
 * compartan un resultado en vez de pagar cada uno el viaje de auth más dos
 * lecturas. El memo dura un solo render, así que un cambio de rol se ve en el
 * click siguiente: es deduplicación, no caché entre requests.
 */
export const requireFamily = cache(async function requireFamily(): Promise<FamilyContext> {
  const supabase = await createClient();

  // getClaims() y no getUser(): verifica el JWT localmente contra el JWKS
  // cacheado en vez de preguntarle al servidor de auth. Y como family_id ya
  // viaja en el token (custom_access_token_hook), las dos lecturas de abajo
  // salen en paralelo en lugar de encadenarse detrás de un getUser().
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims?.sub) redirect("/ingresar");

  const claimRole = typeof claims.user_role === "string" ? claims.user_role : "";
  const claimFamilyId = typeof claims.family_id === "string" ? claims.family_id : null;

  // El hook deja ambos claims en blanco para un usuario sin familia todavía y
  // también para uno desactivado. Los dos casos terminan en el mismo lugar:
  // elegir crear una familia o entrar con un código.
  if (!claimRole || !claimFamilyId) redirect("/bienvenida");

  const [familyResult, membersResult] = await Promise.all([
    supabase.from("families").select("*").eq("id", claimFamilyId).single(),
    supabase
      .from("family_members")
      .select("*")
      .eq("is_archived", false)
      .order("position", { ascending: true }),
  ]);

  // Familia inexistente significa que el claim apunta a algo borrado, o que el
  // hook está apagado y RLS niega todo. En cualquier caso, no hay app.
  if (familyResult.error || !familyResult.data) redirect("/bienvenida");

  const members = membersResult.data ?? [];
  const member = members.find((m) => m.profile_id === claims.sub);

  // Sesión válida y familia válida, pero sin ficha propia: pasa si alguien
  // borró el family_member a mano. Se manda al onboarding en vez de romper.
  if (!member) redirect("/bienvenida");

  return {
    userId: claims.sub,
    role: claimRole === "parent" ? "parent" : "child",
    family: familyResult.data,
    member,
    members,
  };
});

/**
 * Pantallas de adultos: finanzas, expediente, ajustes de la familia.
 *
 * Esto es una compuerta de UX. Lo que realmente impide que un `child` lea un
 * gasto es la policy de RLS; si esta función desapareciera, la pantalla se
 * renderizaría vacía en vez de filtrar datos.
 */
export async function requireParent(): Promise<FamilyContext> {
  const context = await requireFamily();
  if (context.role !== "parent") redirect("/");
  return context;
}

/** Contexto si hay sesión con familia, o null. Para pantallas públicas. */
export async function getFamilyOrNull(): Promise<FamilyContext | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub || typeof claims.family_id !== "string" || !claims.family_id) {
    return null;
  }
  return requireFamily();
}
