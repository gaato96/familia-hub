import { describe, expect, it } from "vitest";

import {
  goalProgress,
  goalUrgency,
  openStepsFor,
  sortGoals,
  summarizeGoals,
  type GoalWithSteps,
} from "@/lib/goals/progress";
import type { GoalStepRow } from "@/types/database";

const TODAY = "2026-09-10";

function step(overrides: Partial<GoalStepRow> = {}): GoalStepRow {
  return {
    id: crypto.randomUUID(),
    family_id: "f",
    goal_id: "g",
    title: "Un paso",
    assigned_member_id: null,
    due_date: null,
    done_at: null,
    done_by_member_id: null,
    position: 0,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

function goal(overrides: Partial<GoalWithSteps> = {}): GoalWithSteps {
  return {
    id: crypto.randomUUID(),
    family_id: "f",
    title: "Ordenar el garage",
    detail: null,
    category: "casa",
    owner_member_id: null,
    target_date: null,
    status: "activo",
    achieved_on: null,
    position: 0,
    created_by_member_id: null,
    created_at: "",
    updated_at: "",
    steps: [],
    ...overrides,
  };
}

describe("goalProgress", () => {
  it("cuenta los pasos tildados", () => {
    const progress = goalProgress(
      goal({ steps: [step({ done_at: "2026-09-01T10:00:00Z" }), step(), step()] }),
    );
    expect(progress).toEqual({ done: 1, total: 3, ratio: 1 / 3 });
  });

  it("un objetivo sin pasos vale cero y no NaN", () => {
    // NaN se propaga a `width: NaN%` y la barra desaparece sin ningún error
    // que explique por qué.
    const progress = goalProgress(goal());
    expect(progress.ratio).toBe(0);
    expect(Number.isNaN(progress.ratio)).toBe(false);
  });

  it("uno logrado sin pasos vale 100%", () => {
    // "Conseguir turno con la fonoaudióloga" se logra de una, sin partirlo.
    expect(goalProgress(goal({ status: "logrado" })).ratio).toBe(1);
  });

  it("logrado con pasos sin tildar muestra los pasos reales", () => {
    // A propósito: el estado lo pone una persona y los pasos son otra cosa.
    // Inflar la barra al 100% escondería que quedaron cabos sueltos.
    expect(goalProgress(goal({ status: "logrado", steps: [step(), step()] })).ratio).toBe(0);
  });
});

describe("goalUrgency", () => {
  it("marca vencido, hoy y esta semana", () => {
    expect(goalUrgency({ status: "activo", target_date: "2026-09-09" }, TODAY)).toBe("vencido");
    expect(goalUrgency({ status: "activo", target_date: TODAY }, TODAY)).toBe("hoy");
    expect(goalUrgency({ status: "activo", target_date: "2026-09-17" }, TODAY)).toBe(
      "esta-semana",
    );
    expect(goalUrgency({ status: "activo", target_date: "2026-09-18" }, TODAY)).toBeNull();
  });

  it("sin fecha no hay urgencia", () => {
    expect(goalUrgency({ status: "activo", target_date: null }, TODAY)).toBeNull();
  });

  it("uno logrado con fecha pasada no está vencido, está hecho", () => {
    expect(goalUrgency({ status: "logrado", target_date: "2026-01-01" }, TODAY)).toBeNull();
    expect(goalUrgency({ status: "pausado", target_date: "2026-01-01" }, TODAY)).toBeNull();
  });
});

describe("sortGoals", () => {
  it("lo activo primero y lo logrado al final", () => {
    const sorted = sortGoals([
      goal({ title: "Logrado", status: "logrado" }),
      goal({ title: "Pausado", status: "pausado" }),
      goal({ title: "Activo", status: "activo" }),
    ]);
    expect(sorted.map((g) => g.title)).toEqual(["Activo", "Pausado", "Logrado"]);
  });

  it("con fecha antes que sin fecha", () => {
    // Un objetivo con plazo es un compromiso; uno sin plazo es una intención.
    const sorted = sortGoals([
      goal({ title: "Sin fecha" }),
      goal({ title: "Con fecha", target_date: "2026-12-01" }),
    ]);
    expect(sorted.map((g) => g.title)).toEqual(["Con fecha", "Sin fecha"]);
  });

  it("entre dos con fecha gana la más cercana", () => {
    const sorted = sortGoals([
      goal({ title: "Diciembre", target_date: "2026-12-01" }),
      goal({ title: "Octubre", target_date: "2026-10-01" }),
    ]);
    expect(sorted.map((g) => g.title)).toEqual(["Octubre", "Diciembre"]);
  });

  it("no muta el arreglo que recibe", () => {
    const goals = [goal({ title: "B", status: "logrado" }), goal({ title: "A" })];
    sortGoals(goals);
    expect(goals.map((g) => g.title)).toEqual(["B", "A"]);
  });
});

describe("summarizeGoals", () => {
  it("promedia sobre los pasos y no sobre los objetivos", () => {
    // Un objetivo de 1 paso tildado y otro de 10 sin tildar: promediar por
    // objetivo daría 50%, que le mentiría a la casa sobre cuánto falta.
    const summary = summarizeGoals([
      goal({ steps: [step({ done_at: "x" })] }),
      goal({ steps: Array.from({ length: 10 }, () => step()) }),
    ]);
    expect(summary.doneSteps).toBe(1);
    expect(summary.steps).toBe(11);
    expect(summary.ratio).toBeCloseTo(1 / 11);
  });

  it("ignora los pasos de objetivos que no están activos", () => {
    const summary = summarizeGoals([
      goal({ status: "pausado", steps: [step(), step()] }),
      goal({ status: "activo", steps: [step({ done_at: "x" })] }),
    ]);
    expect(summary.active).toBe(1);
    expect(summary.steps).toBe(1);
    expect(summary.ratio).toBe(1);
  });

  it("sin pasos no divide por cero", () => {
    expect(summarizeGoals([goal()]).ratio).toBe(0);
  });
});

describe("openStepsFor", () => {
  it("trae solo lo pendiente de esa persona, con fecha primero", () => {
    const mine = "m1";
    const steps = openStepsFor(
      [
        goal({
          steps: [
            step({ title: "Sin fecha", assigned_member_id: mine }),
            step({ title: "Mañana", assigned_member_id: mine, due_date: "2026-09-11" }),
            step({ title: "Ya hecho", assigned_member_id: mine, done_at: "x" }),
            step({ title: "De otro", assigned_member_id: "m2" }),
            step({ title: "De nadie" }),
          ],
        }),
      ],
      mine,
    );
    expect(steps.map((s) => s.title)).toEqual(["Mañana", "Sin fecha"]);
  });

  it("un objetivo pausado no le reclama nada a nadie", () => {
    const steps = openStepsFor(
      [goal({ status: "pausado", steps: [step({ assigned_member_id: "m1" })] })],
      "m1",
    );
    expect(steps).toEqual([]);
  });
});
