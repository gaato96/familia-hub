import { describe, expect, it } from "vitest";

import {
  assigneeForOccurrence,
  describeRecurrence,
  occurrencesBetween,
} from "@/lib/tasks/recurrence";

/**
 * La recurrencia es la parte con más lógica sutil del proyecto y la que más
 * caro sale que falle: una tarea que no se genera no molesta a nadie hasta que
 * la casa está sucia, y una que se genera de más satura el planner.
 *
 * `today` va fijo en todos los casos para que los tests no cambien de resultado
 * según el día en que se corran.
 */
const TODAY = "2026-08-20";

describe("occurrencesBetween", () => {
  it("una tarea puntual tiene exactamente una ocurrencia, en su fecha de inicio", () => {
    expect(
      occurrencesBetween(null, { startsOn: "2026-09-01", until: "2026-12-31", today: TODAY }),
    ).toEqual(["2026-09-01"]);
  });

  it("cada N días arranca en la fecha de inicio, no N días después", () => {
    expect(
      occurrencesBetween(
        { freq: "days", interval: 15 },
        { startsOn: "2026-09-01", until: "2026-10-15", today: TODAY },
      ),
    ).toEqual(["2026-09-01", "2026-09-16", "2026-10-01"]);
  });

  it("los días fijos de la semana incluyen el día de inicio si corresponde", () => {
    // 2026-08-24 es lunes. Lunes (1) y jueves (4).
    expect(
      occurrencesBetween(
        { freq: "weekly", byweekday: [1, 4] },
        { startsOn: "2026-08-24", until: "2026-09-06", today: TODAY },
      ),
    ).toEqual(["2026-08-24", "2026-08-27", "2026-08-31", "2026-09-03"]);
  });

  it("mensual el 31 cae el último día en los meses que no lo tienen", () => {
    // Febrero de 2027 tiene 28 días; abril, 30.
    expect(
      occurrencesBetween(
        { freq: "monthly", bymonthday: 31 },
        { startsOn: "2027-01-31", until: "2027-04-30", today: "2027-01-01" },
      ),
    ).toEqual(["2027-01-31", "2027-02-28", "2027-03-31", "2027-04-30"]);
  });

  it("mensual salta el mes de inicio si el día ya pasó", () => {
    // Empieza el 20 pero la regla es "el 5 de cada mes": el 5 de agosto ya pasó.
    expect(
      occurrencesBetween(
        { freq: "monthly", bymonthday: 5 },
        { startsOn: "2026-08-20", until: "2026-10-31", today: TODAY },
      ),
    ).toEqual(["2026-09-05", "2026-10-05"]);
  });

  it("`from` descarta lo anterior sin correr el ancla de la regla", () => {
    // El ritmo lo sigue marcando startsOn: si `from` corriera el ancla, las
    // fechas caerían en 6/21 en vez de 1/16.
    expect(
      occurrencesBetween(
        { freq: "days", interval: 15 },
        {
          startsOn: "2026-09-01",
          from: "2026-09-10",
          until: "2026-10-20",
          today: TODAY,
        },
      ),
    ).toEqual(["2026-09-16", "2026-10-01", "2026-10-16"]);
  });

  it("`limit` corta la previsualización", () => {
    expect(
      occurrencesBetween(
        { freq: "days", interval: 1 },
        { startsOn: "2026-09-01", until: "2026-12-31", limit: 3, today: TODAY },
      ),
    ).toHaveLength(3);
  });

  it("no genera nada si el rango termina antes de empezar", () => {
    expect(
      occurrencesBetween(
        { freq: "days", interval: 7 },
        { startsOn: "2026-09-01", until: "2026-08-01", today: TODAY },
      ),
    ).toEqual([]);
  });

  it("respeta el techo de 400 días desde hoy, no desde el inicio", () => {
    // Una tarea vieja tiene que seguir generando las de este mes: si el techo
    // colgara de startsOn, esto daría cero.
    const result = occurrencesBetween(
      { freq: "monthly", bymonthday: 1 },
      { startsOn: "2020-01-01", from: TODAY, until: "2026-12-31", today: TODAY },
    );
    expect(result).toEqual(["2026-09-01", "2026-10-01", "2026-11-01", "2026-12-01"]);
  });

  it("no cruza la medianoche por husos horarios", () => {
    // Todo el cálculo es en UTC justamente para que el resultado no dependa de
    // la zona del proceso. Un mes completo sin días repetidos ni faltantes.
    const days = occurrencesBetween(
      { freq: "days", interval: 1 },
      { startsOn: "2026-03-01", until: "2026-03-31", today: "2026-03-01" },
    );
    expect(days).toHaveLength(31);
    expect(new Set(days).size).toBe(31);
    expect(days.at(-1)).toBe("2026-03-31");
  });
});

describe("assigneeForOccurrence", () => {
  it("sin rotación no asigna a nadie", () => {
    expect(assigneeForOccurrence([], 3)).toBeNull();
  });

  it("con un solo responsable, siempre el mismo", () => {
    expect(assigneeForOccurrence(["ana"], 7)).toBe("ana");
  });

  it("rota en orden y vuelve a empezar", () => {
    const rotation = ["ana", "beto", "caro"];
    expect([0, 1, 2, 3, 4].map((i) => assigneeForOccurrence(rotation, i))).toEqual([
      "ana",
      "beto",
      "caro",
      "ana",
      "beto",
    ]);
  });
});

describe("describeRecurrence", () => {
  it("traduce cada forma a algo que se puede leer en voz alta", () => {
    expect(describeRecurrence(null)).toBe("una sola vez");
    expect(describeRecurrence({ freq: "days", interval: 1 })).toBe("todos los días");
    expect(describeRecurrence({ freq: "days", interval: 15 })).toBe("cada 15 días");
    expect(describeRecurrence({ freq: "weekly", byweekday: [1] })).toBe("todos los lunes");
    expect(describeRecurrence({ freq: "weekly", byweekday: [4, 1] })).toBe("lunes y jueves");
    expect(describeRecurrence({ freq: "monthly", bymonthday: 28 })).toBe("el 28 de cada mes");
  });
});
