import { describe, expect, it } from "vitest";

import { formatMoney, parseMoneyToCents, splitByBasisPoints, sumCents } from "@/lib/money";

describe("parseMoneyToCents", () => {
  it("entiende lo que se tipea de verdad en un campo de precio", () => {
    expect(parseMoneyToCents("15400")).toBe(1_540_000);
    expect(parseMoneyToCents("15.400")).toBe(1_540_000);
    expect(parseMoneyToCents("15400,50")).toBe(1_540_050);
    expect(parseMoneyToCents("$ 15400")).toBe(1_540_000);
  });

  it("rechaza lo que no es un monto", () => {
    expect(parseMoneyToCents("")).toBeNull();
    expect(parseMoneyToCents("abc")).toBeNull();
    expect(parseMoneyToCents("-100")).toBeNull();
  });
});

describe("formatMoney", () => {
  it("muestra decimales solo cuando aportan información", () => {
    expect(formatMoney(1_540_000)).not.toContain(",00");
    expect(formatMoney(1_540_050)).toContain("50");
  });
});

describe("splitByBasisPoints", () => {
  it("reparte sin perder ni un centavo", () => {
    // Los seis rubros del módulo de Finanzas sobre un ingreso que no divide
    // exacto. Esta es la garantía que importa: la suma de las partes tiene que
    // ser IGUAL al total, o el presupuesto muestra una diferencia inexplicable.
    const total = 1_234_567;
    const weights = [3500, 1000, 2500, 1500, 750, 750];
    const parts = splitByBasisPoints(total, weights);

    expect(sumCents(parts)).toBe(total);
    expect(parts).toHaveLength(weights.length);
  });

  it("le da el resto a las partes con mayor resto fraccionario", () => {
    // 10 centavos en tres partes iguales: 4/3/3, no 3/3/3 con uno perdido.
    const parts = splitByBasisPoints(10, [3333, 3333, 3334]);
    expect(sumCents(parts)).toBe(10);
    expect(parts.filter((p) => p === 4)).toHaveLength(1);
  });

  it("con pesos en cero devuelve todo en cero en vez de dividir por cero", () => {
    expect(splitByBasisPoints(1000, [0, 0])).toEqual([0, 0]);
  });
});
