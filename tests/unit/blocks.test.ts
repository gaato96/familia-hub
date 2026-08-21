import { describe, expect, it } from "vitest";

import {
  assignLanes,
  blockAppliesOn,
  blocksForDate,
  currentBlock,
  formatBlockTime,
  minutesFromTime,
  minutesNowAr,
  nextBlock,
  timeFromMinutes,
  timelineRange,
  untilLabel,
} from "@/lib/agenda/blocks";
import type { TimeBlockRow } from "@/types/database";

function block(overrides: Partial<TimeBlockRow> = {}): TimeBlockRow {
  return {
    id: crypto.randomUUID(),
    family_id: "f",
    member_id: null,
    title: "Trabajo",
    kind: "trabajo",
    starts_at: "09:00:00",
    ends_at: "18:00:00",
    weekdays: [1, 2, 3, 4, 5],
    on_date: null,
    starts_on: null,
    ends_on: null,
    notes: null,
    created_by_member_id: null,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

// 2026-09-07 es lunes; 2026-09-13, domingo.
const LUNES = "2026-09-07";
const SABADO = "2026-09-12";
const DOMINGO = "2026-09-13";

describe("minutesFromTime / timeFromMinutes", () => {
  it("acepta el time de Postgres y el de un input", () => {
    expect(minutesFromTime("09:30:00")).toBe(570);
    expect(minutesFromTime("09:30")).toBe(570);
    expect(minutesFromTime("00:00:00")).toBe(0);
  });

  it("vuelve del número al texto sin perder el cero de adelante", () => {
    expect(timeFromMinutes(570)).toBe("09:30");
    expect(timeFromMinutes(0)).toBe("00:00");
    expect(timeFromMinutes(23 * 60 + 5)).toBe("23:05");
  });

  it("la hora en punto se escribe sin :00", () => {
    // "Trabajo de 9 a 18" es como se dice; "09:00 a 18:00" es un parte médico.
    expect(formatBlockTime("09:00:00")).toBe("9");
    expect(formatBlockTime("13:45:00")).toBe("13:45");
  });
});

describe("blockAppliesOn", () => {
  it("el recurrente aplica solo a sus días de semana", () => {
    const trabajo = block();
    expect(blockAppliesOn(trabajo, LUNES)).toBe(true);
    expect(blockAppliesOn(trabajo, SABADO)).toBe(false);
  });

  it("el domingo es 7 y no 0", () => {
    // getUTCDay() devuelve 0 el domingo. Un bloque de domingo guardado como 7
    // desaparecería del calendario entero si esa conversión estuviera mal, y
    // el síntoma sería "el domingo no anda" sin ningún error.
    expect(blockAppliesOn(block({ weekdays: [7] }), DOMINGO)).toBe(true);
    expect(blockAppliesOn(block({ weekdays: [7] }), LUNES)).toBe(false);
  });

  it("el puntual aplica a su fecha y a ninguna otra", () => {
    const viaje = block({ weekdays: null, on_date: SABADO });
    expect(blockAppliesOn(viaje, SABADO)).toBe(true);
    expect(blockAppliesOn(viaje, LUNES)).toBe(false);
  });

  it("la vigencia acota al recurrente por los dos lados", () => {
    // El caso que justifica las columnas: mamá cambió de horario, el bloque
    // viejo se cierra en vez de borrarse y el planner de antes sigue bien.
    const viejo = block({ ends_on: "2026-09-04" });
    const nuevo = block({ starts_on: "2026-09-05" });

    expect(blockAppliesOn(viejo, LUNES)).toBe(false);
    expect(blockAppliesOn(nuevo, LUNES)).toBe(true);
    expect(blockAppliesOn(nuevo, "2026-09-04")).toBe(false);
  });

  it("la vigencia incluye sus bordes", () => {
    expect(blockAppliesOn(block({ starts_on: LUNES }), LUNES)).toBe(true);
    expect(blockAppliesOn(block({ ends_on: LUNES }), LUNES)).toBe(true);
  });

  it("un recurrente sin días no aplica nunca en vez de aplicar siempre", () => {
    expect(blockAppliesOn(block({ weekdays: [] }), LUNES)).toBe(false);
  });
});

describe("assignLanes", () => {
  it("lo que no se solapa ocupa todo el ancho", () => {
    const lanes = assignLanes([
      { startMinutes: 540, endMinutes: 600 },
      { startMinutes: 600, endMinutes: 660 },
    ]);
    expect(lanes).toEqual([
      { lane: 0, laneCount: 1 },
      { lane: 0, laneCount: 1 },
    ]);
  });

  it("tocarse de punta a punta no es solaparse", () => {
    // 9-10 y 10-11 no compiten por el mismo minuto; si contaran como
    // solapados, un día normal quedaría partido en dos columnas flacas.
    const lanes = assignLanes([
      { startMinutes: 540, endMinutes: 600 },
      { startMinutes: 600, endMinutes: 660 },
    ]);
    expect(lanes.every((l) => l.laneCount === 1)).toBe(true);
  });

  it("dos solapados van a columnas distintas", () => {
    const lanes = assignLanes([
      { startMinutes: 540, endMinutes: 1080 },
      { startMinutes: 480, endMinutes: 780 },
    ]);
    expect(new Set(lanes.map((l) => l.lane)).size).toBe(2);
    expect(lanes.every((l) => l.laneCount === 2)).toBe(true);
  });

  it("el ancho lo decide el racimo, no el día entero", () => {
    // Tres cosas a la mañana no tienen por qué dejar flaca a la única cosa de
    // la noche.
    const lanes = assignLanes([
      { startMinutes: 540, endMinutes: 660 },
      { startMinutes: 550, endMinutes: 670 },
      { startMinutes: 560, endMinutes: 680 },
      { startMinutes: 1200, endMinutes: 1300 },
    ]);
    expect(lanes.slice(0, 3).every((l) => l.laneCount === 3)).toBe(true);
    expect(lanes[3]).toEqual({ lane: 0, laneCount: 1 });
  });

  it("reusa una columna que ya se liberó", () => {
    const lanes = assignLanes([
      { startMinutes: 540, endMinutes: 600 }, // 9-10
      { startMinutes: 550, endMinutes: 700 }, // 9:10-11:40, solapa con el 1ro
      { startMinutes: 610, endMinutes: 660 }, // 10:10-11, cabe donde estaba el 1ro
    ]);
    expect(lanes[0].lane).toBe(0);
    expect(lanes[1].lane).toBe(1);
    expect(lanes[2].lane).toBe(0);
  });

  it("devuelve un resultado por ítem, en el orden de entrada", () => {
    const items = [
      { startMinutes: 1200, endMinutes: 1300 },
      { startMinutes: 540, endMinutes: 600 },
    ];
    expect(assignLanes(items)).toHaveLength(2);
    // El de las 20 entró primero y sigue primero, aunque se ordene por hora
    // adentro para calcular.
    expect(assignLanes(items)[0]).toEqual({ lane: 0, laneCount: 1 });
  });

  it("sin ítems no explota", () => {
    expect(assignLanes([])).toEqual([]);
  });
});

describe("blocksForDate", () => {
  const agenda = [
    block({ title: "Trabajo mamá", starts_at: "09:00:00", ends_at: "18:00:00" }),
    block({ title: "Colegio", starts_at: "08:00:00", ends_at: "13:00:00" }),
    block({ title: "Almuerzo", starts_at: "13:00:00", ends_at: "14:00:00", weekdays: [1, 2, 3, 4, 5, 6, 7] }),
    block({ title: "Fin de semana", weekdays: [6, 7] }),
  ];

  it("trae solo los del día, ordenados por hora", () => {
    const day = blocksForDate(agenda, LUNES);
    expect(day.map((d) => d.block.title)).toEqual(["Colegio", "Trabajo mamá", "Almuerzo"]);
  });

  it("calcula minutos de inicio y fin", () => {
    const [colegio] = blocksForDate(agenda, LUNES);
    expect(colegio.startMinutes).toBe(480);
    expect(colegio.endMinutes).toBe(780);
  });

  it("el sábado muestra otra cosa", () => {
    expect(blocksForDate(agenda, SABADO).map((d) => d.block.title)).toEqual([
      "Fin de semana",
      "Almuerzo",
    ]);
  });
});

describe("timelineRange", () => {
  it("un día vacío igual dibuja de 7 a 23", () => {
    // Si la ventana se ajustara solo a lo que hay, un día con un único bloque
    // a las 14 se vería como si la mañana no existiera.
    expect(timelineRange([])).toEqual({ fromHour: 7, toHour: 23 });
  });

  it("se agranda para cubrir lo que cae afuera", () => {
    const day = blocksForDate(
      [block({ starts_at: "05:30:00", ends_at: "06:15:00", weekdays: [1] })],
      LUNES,
    );
    expect(timelineRange(day).fromHour).toBe(5);
  });

  it("un bloque hasta la medianoche no se pasa de 24", () => {
    const day = blocksForDate(
      [block({ starts_at: "22:00:00", ends_at: "23:59:00", weekdays: [1] })],
      LUNES,
    );
    expect(timelineRange(day).toHour).toBe(24);
  });
});

describe("currentBlock / nextBlock", () => {
  const day = blocksForDate(
    [
      block({ title: "Colegio", starts_at: "08:00:00", ends_at: "13:00:00", weekdays: [1] }),
      block({ title: "Trabajo", starts_at: "09:00:00", ends_at: "18:00:00", weekdays: [1] }),
      block({ title: "Cena", starts_at: "21:00:00", ends_at: "22:00:00", weekdays: [1] }),
    ],
    LUNES,
  );

  it("entre solapados gana el que termina antes", () => {
    // A las 10 mamá trabaja y Julián está en el colegio. Lo próximo que cambia
    // es el colegio, así que es lo que hay que mostrar como "ahora".
    expect(currentBlock(day, 10 * 60)?.block.title).toBe("Colegio");
  });

  it("el minuto de fin ya no cuenta como en curso", () => {
    // A las 13:00 el colegio terminó. Si contara, la app diría "en el colegio"
    // mientras el chico está en la puerta esperando.
    expect(currentBlock(day, 13 * 60)?.block.title).toBe("Trabajo");
  });

  it("en un hueco no hay nada en curso", () => {
    expect(currentBlock(day, 19 * 60)).toBeNull();
    expect(currentBlock(day, 7 * 60)).toBeNull();
  });

  it("lo que sigue es lo próximo que empieza, no lo que está pasando", () => {
    expect(nextBlock(day, 10 * 60)?.block.title).toBe("Cena");
    expect(nextBlock(day, 22 * 60)).toBeNull();
  });
});

describe("minutesNowAr", () => {
  it("convierte a hora argentina y no a la del proceso", () => {
    // 2026-09-07T15:00:00Z son las 12:00 en Argentina.
    expect(minutesNowAr(new Date("2026-09-07T15:00:00Z"))).toBe(12 * 60);
  });
});

describe("untilLabel", () => {
  it("dice minutos, horas y horas con minutos", () => {
    expect(untilLabel(20)).toBe("en 20 min");
    expect(untilLabel(120)).toBe("en 2 h");
    expect(untilLabel(135)).toBe("en 2 h 15");
  });

  it("hacia atrás cambia la preposición y no el signo", () => {
    expect(untilLabel(-10)).toBe("hace 10 min");
  });
});
