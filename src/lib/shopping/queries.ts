import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, ShoppingItemRow, ShoppingListKind, ShoppingListRow } from "@/types/database";

export type ShoppingList = ShoppingListRow;
export type ShoppingItem = ShoppingItemRow;

export async function fetchLists(
  supabase: SupabaseClient<Database>,
): Promise<ShoppingList[]> {
  const { data, error } = await supabase
    .from("shopping_lists")
    .select("*")
    .eq("is_archived", false)
    .order("position", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function fetchItems(
  supabase: SupabaseClient<Database>,
): Promise<ShoppingItem[]> {
  const { data, error } = await supabase
    .from("shopping_items")
    .select("*")
    // Lo pendiente primero y lo comprado abajo: en la góndola lo que importa
    // es lo que falta, no lo que ya está en el changuito.
    .order("is_checked", { ascending: true })
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/** Ícono y color por tipo de lista. El acento hace que se distingan de un vistazo. */
export const LIST_STYLE: Record<ShoppingListKind, { emoji: string; accent: string }> = {
  supermercado: { emoji: "\u{1F6D2}", accent: "#2563EB" },
  verduleria: { emoji: "\u{1F966}", accent: "#16A34A" },
  farmacia: { emoji: "\u{1F48A}", accent: "#DC2626" },
  hogar: { emoji: "\u{1F6CB}", accent: "#A16207" },
  caprichos: { emoji: "\u{1F36B}", accent: "#DB2777" },
  regalos: { emoji: "\u{1F381}", accent: "#7C3AED" },
  general: { emoji: "\u{1F4DD}", accent: "#525252" },
};
