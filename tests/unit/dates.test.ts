import { describe, expect, it } from "vitest";

import {
  addDaysIso,
  isOverdue,
  relativeDayLabel,
  startOfWeekAr,
  todayInAr,
  weekDaysAr,
} from "@/lib/dates";

describe("startOfWeekAr", () => {
  it("la semana arranca el lunes", () => {
    // 2026-08-20 es jueves.
    expect(startOfWeekAr("2026-08-20")).toBe("2026-08-17");
  });

  it("el domingo pertenece a la semana que TERMINA, no a la que empieza", () => {
    // Es el caso que se rompe si se copia la convención de EE.UU.: el domingo
    // a la noche, cuando se mira el resumen, la semana en curso es la que
    // arrancó el lunes anterior.
    expect(startOfWeekAr("2026-08-23")).toBe("2026-08-17");
  });

  it("un lunes es su propio inicio de semana", () => {
    expect(startOfWeekAr("2026-08-17")).toBe("2026-08-17");
  });
});

describe("weekDaysAr", () => {
  it("devuelve siete días de lunes a domingo", () => {
    const days = weekDaysAr("2026-08-20");
    expect(days).toHaveLength(7);
    expect(days[0]).toBe("2026-08-17");
    expect(days[6]).toBe("2026-08-23");
  });
});

describe("addDaysIso", () => {
  it("cruza el fin de mes y el fin de año", () => {
    expect(addDaysIso("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDaysIso("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysIso("2027-03-01", -1)).toBe("2027-02-28");
  });
});

describe("todayInAr", () => {
  it("usa el día argentino, no el UTC", () => {
    // 2026-08-21 a las 02:00 UTC son todavía las 23:00 del 20 en Argentina.
    expect(todayInAr(new Date("2026-08-21T02:00:00Z"))).toBe("2026-08-20");
    // Y a las 04:00 UTC ya es 21 acá.
    expect(todayInAr(new Date("2026-08-21T04:00:00Z"))).toBe("2026-08-21");
  });
});

describe("relativeDayLabel", () => {
  it("dice los días cercanos con palabras", () => {
    expect(relativeDayLabel("2026-08-20", "2026-08-20")).toBe("hoy");
    expect(relativeDayLabel("2026-08-21", "2026-08-20")).toBe("mañana");
    expect(relativeDayLabel("2026-08-19", "2026-08-20")).toBe("ayer");
    expect(relativeDayLabel("2026-08-23", "2026-08-20")).toBe("en 3 días");
    expect(relativeDayLabel("2026-08-18", "2026-08-20")).toBe("hace 2 días");
  });
});

describe("isOverdue", () => {
  it("hoy no está vencido", () => {
    expect(isOverdue("2026-08-20", "2026-08-20")).toBe(false);
    expect(isOverdue("2026-08-19", "2026-08-20")).toBe(true);
  });
});
