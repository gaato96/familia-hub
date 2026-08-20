import { describe, expect, it } from "vitest";

import {
  ageLabel,
  formatHeight,
  formatWeight,
  parseHeadCircToMm,
  parseHeightToMm,
  parseWeightToGrams,
} from "@/lib/records/measures";

describe("parseWeightToGrams", () => {
  it("acepta coma y punto: en Argentina se tipea con coma", () => {
    expect(parseWeightToGrams("12,4")).toBe(12_400);
    expect(parseWeightToGrams("12.4")).toBe(12_400);
    expect(parseWeightToGrams("3")).toBe(3_000);
  });

  it("redondea al gramo sin dejar float suelto", () => {
    // 3.456 kg * 1000 en punto flotante da 3455.9999...; sin el Math.round
    // esto se guardaría como 3455.
    expect(parseWeightToGrams("3,456")).toBe(3_456);
  });

  it("rechaza lo que está fuera del rango que acepta la base", () => {
    expect(parseWeightToGrams("0")).toBeNull();
    expect(parseWeightToGrams("0,1")).toBeNull(); // 100 g, por debajo del CHECK
    expect(parseWeightToGrams("500")).toBeNull(); // 500 kg
    expect(parseWeightToGrams("abc")).toBeNull();
    expect(parseWeightToGrams("")).toBeNull();
  });
});

describe("parseHeightToMm y parseHeadCircToMm", () => {
  it("convierten centímetros a milímetros enteros", () => {
    expect(parseHeightToMm("87")).toBe(870);
    expect(parseHeightToMm("87,5")).toBe(875);
    expect(parseHeadCircToMm("46,2")).toBe(462);
  });

  it("rechazan valores imposibles", () => {
    expect(parseHeightToMm("5")).toBeNull(); // 5 cm
    expect(parseHeightToMm("300")).toBeNull(); // 3 metros
    expect(parseHeadCircToMm("100")).toBeNull(); // 1 metro de cabeza
  });
});

describe("formato", () => {
  it("no muestra decimales cuando el peso es redondo", () => {
    expect(formatWeight(3_000)).toBe("3 kg");
    expect(formatWeight(12_400)).toBe("12.4 kg");
    expect(formatWeight(null)).toBe("—");
  });

  it("la talla muestra un decimal solo si aporta", () => {
    expect(formatHeight(870)).toBe("87 cm");
    expect(formatHeight(875)).toBe("87.5 cm");
    expect(formatHeight(null)).toBe("—");
  });
});

describe("ageLabel", () => {
  it("usa meses hasta los 2 años, que es como habla un pediatra", () => {
    expect(ageLabel("2025-08-20", "2026-08-20")).toBe("12 meses");
    expect(ageLabel("2025-02-20", "2026-08-20")).toBe("18 meses");
    expect(ageLabel("2026-07-20", "2026-08-20")).toBe("1 mes");
  });

  it("pasa a años recién a los 24 meses", () => {
    expect(ageLabel("2024-08-20", "2026-08-20")).toBe("2 años");
    expect(ageLabel("2024-05-20", "2026-08-20")).toBe("2 años y 3 meses");
  });

  it("los primeros días se cuentan en días", () => {
    expect(ageLabel("2026-08-15", "2026-08-20")).toBe("5 días");
    expect(ageLabel("2026-08-19", "2026-08-20")).toBe("1 día");
  });

  it("no cuenta un mes que todavía no se cumplió", () => {
    // Nació un 31; al 30 del mes siguiente todavía no cumplió el mes.
    expect(ageLabel("2026-01-31", "2026-02-28")).toBe("28 días");
    expect(ageLabel("2026-01-15", "2026-02-14")).toBe("30 días");
    expect(ageLabel("2026-01-15", "2026-02-15")).toBe("1 mes");
  });

  it("devuelve null sin fecha de nacimiento o con una fecha futura", () => {
    expect(ageLabel(null, "2026-08-20")).toBeNull();
    expect(ageLabel("2027-01-01", "2026-08-20")).toBeNull();
  });
});
