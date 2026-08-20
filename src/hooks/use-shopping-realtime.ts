"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { fetchItems, type ShoppingItem } from "@/lib/shopping/queries";
import { createClient } from "@/lib/supabase/client";

/**
 * Ítems de compras en vivo, con las mismas tres fuentes redundantes que el
 * tablero de notas — el porqué de cada una está explicado en
 * src/hooks/use-notes-realtime.ts, leerlo antes de tocar esto.
 *
 * Acá importa incluso más: dos personas separadas en el súper tienen que ver
 * el mismo estado, o vuelven a casa con dos paquetes de café.
 */
const POLL_INTERVAL_MS = 30_000;

export function useShoppingRealtime(initialItems: ShoppingItem[]) {
  const [items, setItems] = useState<ShoppingItem[]>(initialItems);
  const supabaseRef = useRef(createClient());

  const refetch = useCallback(async () => {
    try {
      setItems(await fetchItems(supabaseRef.current));
    } catch {
      // Se queda con lo último bueno: una lista vacía por un error de red
      // haría creer que ya está todo comprado.
    }
  }, []);

  useEffect(() => {
    const supabase = supabaseRef.current;

    const channel = supabase
      .channel("shopping-items")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shopping_items" },
        () => void refetch(),
      )
      .subscribe();

    const timer = setInterval(() => void refetch(), POLL_INTERVAL_MS);

    const onFocus = () => void refetch();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refetch();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      void supabase.removeChannel(channel);
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refetch]);

  return { items, setItems, refetch };
}
