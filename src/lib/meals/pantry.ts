import type { PantryItemRow, PantryLocation } from "@/types/database";

/**
 * Lógica pura de la despensa.
 *
 * Las dos preguntas que el módulo tiene que contestar de un vistazo son "¿qué
 * se está por vencer?" y "¿qué hay que reponer?". Todo lo demás es una lista.
 */

/** Días de anticipación con los que un vencimiento pasa a ser urgente. */
export const EXPIRING_SOON_DAYS = 5;

export type PantryAlert = "vencido" | "por-vencer" | "reponer" | null;

/**
 * El estado de un ítem, en orden de urgencia.
 *
 * Vencido gana sobre "hay que reponer": comprar más de algo que está podrido
 * en la heladera no es la acción correcta — primero hay que tirarlo.
 */
export function pantryAlert(item: PantryItemRow, today: string): PantryAlert {
  if (item.expires_on) {
    if (item.expires_on < today) return "vencido";

    const daysLeft = Math.round(
      (Date.parse(`${item.expires_on}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) /
        86_400_000,
    );
    if (daysLeft <= EXPIRING_SOON_DAYS) return "por-vencer";
  }

  // `min_quantity` en 0 es una respuesta válida ("no me importa el stock"), así
  // que se compara contra null y no contra un valor falsy.
  if (item.min_quantity !== null && item.quantity <= item.min_quantity) {
    return "reponer";
  }

  return null;
}

export type PantrySummary = {
  expired: PantryItemRow[];
  expiringSoon: PantryItemRow[];
  toRestock: PantryItemRow[];
};

export function summarizePantry(
  items: PantryItemRow[],
  today: string,
): PantrySummary {
  const summary: PantrySummary = { expired: [], expiringSoon: [], toRestock: [] };

  for (const item of items) {
    switch (pantryAlert(item, today)) {
      case "vencido":
        summary.expired.push(item);
        break;
      case "por-vencer":
        summary.expiringSoon.push(item);
        break;
      case "reponer":
        summary.toRestock.push(item);
        break;
    }
  }

  return summary;
}

/** "2 kg", "3", "media docena". Las cantidades no llevan ceros de más. */
export function formatQuantity(quantity: number, unit: string | null): string {
  const number = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(quantity);
  return unit ? `${number} ${unit}` : number;
}

export const PANTRY_LOCATIONS: { value: PantryLocation; label: string }[] = [
  { value: "heladera", label: "Heladera" },
  { value: "freezer", label: "Freezer" },
  { value: "despensa", label: "Despensa" },
  { value: "limpieza", label: "Limpieza" },
  { value: "otro", label: "Otro" },
];

export function locationLabel(location: PantryLocation): string {
  return PANTRY_LOCATIONS.find((l) => l.value === location)?.label ?? location;
}
