import { describe, expect, it } from "vitest";

import { formatQuantity, pantryAlert, summarizePantry } from "@/lib/meals/pantry";
import type { PantryItemRow } from "@/types/database";

function item(overrides: Partial<PantryItemRow> = {}): PantryItemRow {
  return {
    id: crypto.randomUUID(),
    family_id: "f",
    name: "Leche",
    quantity: 2,
    unit: "litros",
    location: "heladera",
    min_quantity: null,
    expires_on: null,
    notes: null,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

const TODAY = "2026-09-10";

describe("pantryAlert", () => {
  it("sin vencimiento ni mínimo no alerta nada", () => {
    expect(pantryAlert(item(), TODAY)).toBeNull();
  });

  it("marca vencido y por vencer según la fecha", () => {
    expect(pantryAlert(item({ expires_on: "2026-09-09" }), TODAY)).toBe("vencido");
    expect(pantryAlert(item({ expires_on: "2026-09-15" }), TODAY)).toBe("por-vencer");
    expect(pantryAlert(item({ expires_on: "2026-09-16" }), TODAY)).toBeNull();
  });

  it("lo que vence hoy todavía no está vencido", () => {
    expect(pantryAlert(item({ expires_on: TODAY }), TODAY)).toBe("por-vencer");
  });

  it("avisa de reponer al llegar al mínimo, no solo al pasarlo", () => {
    expect(pantryAlert(item({ quantity: 1, min_quantity: 1 }), TODAY)).toBe("reponer");
    expect(pantryAlert(item({ quantity: 0, min_quantity: 1 }), TODAY)).toBe("reponer");
    expect(pantryAlert(item({ quantity: 2, min_quantity: 1 }), TODAY)).toBeNull();
  });

  it("un mínimo en cero es una respuesta válida, no 'sin mínimo'", () => {
    // Es el caso que se rompe si se compara con un falsy en vez de con null:
    // "avisame cuando no quede nada" tiene que funcionar.
    expect(pantryAlert(item({ quantity: 0, min_quantity: 0 }), TODAY)).toBe("reponer");
    expect(pantryAlert(item({ quantity: 1, min_quantity: 0 }), TODAY)).toBeNull();
  });

  it("vencido le gana a reponer", () => {
    // Comprar más de algo que está podrido en la heladera no es la acción
    // correcta: primero hay que tirarlo.
    expect(
      pantryAlert(item({ quantity: 0, min_quantity: 1, expires_on: "2026-09-01" }), TODAY),
    ).toBe("vencido");
  });
});

describe("summarizePantry", () => {
  it("clasifica cada ítem en un solo grupo", () => {
    const summary = summarizePantry(
      [
        item({ name: "Yogur", expires_on: "2026-09-01" }),
        item({ name: "Queso", expires_on: "2026-09-12" }),
        item({ name: "Café", quantity: 0, min_quantity: 1 }),
        item({ name: "Arroz", quantity: 5, min_quantity: 1 }),
      ],
      TODAY,
    );

    expect(summary.expired.map((i) => i.name)).toEqual(["Yogur"]);
    expect(summary.expiringSoon.map((i) => i.name)).toEqual(["Queso"]);
    expect(summary.toRestock.map((i) => i.name)).toEqual(["Café"]);
    // Arroz no aparece en ningún grupo: está todo bien con el arroz.
    expect(summary.expired.length + summary.expiringSoon.length + summary.toRestock.length).toBe(
      3,
    );
  });
});

describe("formatQuantity", () => {
  it("no arrastra ceros de más", () => {
    expect(formatQuantity(2, "litros")).toBe("2 litros");
    expect(formatQuantity(2.5, "kg")).toBe("2,5 kg");
    expect(formatQuantity(3, null)).toBe("3");
  });
});
