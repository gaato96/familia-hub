import { describe, expect, it } from "vitest";

import {
  expenseStatus,
  formatBp,
  parsePercentToBp,
  summarizeBudget,
  totalsFor,
} from "@/lib/budget/allocate";
import { sumCents } from "@/lib/money";
import type { BudgetAllocationRow, ExpenseRow, IncomeEntryRow } from "@/types/database";

/** Fábricas mínimas: solo lo que el motor de presupuesto realmente mira. */
function allocation(label: string, percentBp: number, id = label): BudgetAllocationRow {
  return {
    id,
    family_id: "f",
    label,
    percent_bp: percentBp,
    member_id: null,
    color: "#000000",
    position: 0,
    created_at: "",
    updated_at: "",
  };
}

function income(amountCents: number): IncomeEntryRow {
  return {
    id: crypto.randomUUID(),
    family_id: "f",
    member_id: null,
    label: "Sueldo",
    amount_cents: amountCents,
    period_month: "2026-09-01",
    received_on: null,
    notes: null,
    created_at: "",
    updated_at: "",
  };
}

function expense(
  amountCents: number,
  overrides: Partial<ExpenseRow> = {},
): ExpenseRow {
  return {
    id: crypto.randomUUID(),
    family_id: "f",
    label: "Gasto",
    category: "varios",
    amount_cents: amountCents,
    due_date: "2026-09-10",
    paid_on: null,
    paid_by_member_id: null,
    allocation_id: null,
    document_id: null,
    is_recurring: false,
    notes: null,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

describe("summarizeBudget", () => {
  it("reparte sin perder ni un centavo", () => {
    // La garantía que importa: lo repartido tiene que ser IGUAL al ingreso.
    // Un ingreso que no divide exacto entre seis rubros es el caso normal.
    const incomeCents = 1_234_567;
    const allocations = [
      allocation("Fijos", 3500),
      allocation("Reserva", 1000),
      allocation("Casa", 2500),
      allocation("Julián", 1500),
      allocation("Mamá", 750),
      allocation("Papá", 750),
    ];

    const summary = summarizeBudget({
      incomes: [income(incomeCents)],
      allocations,
      expenses: [],
    });

    expect(summary.incomeCents).toBe(incomeCents);
    expect(summary.totalBp).toBe(10_000);
    expect(summary.unassignedBp).toBe(0);
    expect(summary.unassignedCents).toBe(0);
    expect(sumCents(summary.slices.map((s) => s.budgetCents))).toBe(incomeCents);
  });

  it("deja visible lo que falta asignar en vez de inflar los rubros", () => {
    // Con los porcentajes al 90%, el 10% restante NO se reparte entre los
    // rubros existentes: se muestra aparte. Si se repartiera, la plata sin
    // destino desaparecería en silencio.
    const summary = summarizeBudget({
      incomes: [income(100_000)],
      allocations: [allocation("Fijos", 5000), allocation("Casa", 4000)],
      expenses: [],
    });

    expect(summary.totalBp).toBe(9_000);
    expect(summary.unassignedBp).toBe(1_000);
    expect(summary.slices[0].budgetCents).toBe(50_000);
    expect(summary.slices[1].budgetCents).toBe(40_000);
    expect(summary.unassignedCents).toBe(10_000);

    // Y aun así, todo suma el ingreso completo.
    expect(sumCents(summary.slices.map((s) => s.budgetCents)) + summary.unassignedCents).toBe(
      100_000,
    );
  });

  it("marca en negativo el rubro que se pasó", () => {
    const summary = summarizeBudget({
      incomes: [income(100_000)],
      allocations: [allocation("Casa", 10_000, "casa")],
      expenses: [expense(120_000, { allocation_id: "casa" })],
    });

    expect(summary.slices[0].budgetCents).toBe(100_000);
    expect(summary.slices[0].spentCents).toBe(120_000);
    expect(summary.slices[0].remainingCents).toBe(-20_000);
  });

  it("ignora los gastos sin rubro imputado", () => {
    const summary = summarizeBudget({
      incomes: [income(100_000)],
      allocations: [allocation("Casa", 10_000, "casa")],
      expenses: [expense(50_000, { allocation_id: null })],
    });

    expect(summary.slices[0].spentCents).toBe(0);
  });

  it("sin ingresos no divide por cero", () => {
    const summary = summarizeBudget({
      incomes: [],
      allocations: [allocation("Casa", 10_000)],
      expenses: [],
    });

    expect(summary.incomeCents).toBe(0);
    expect(summary.slices[0].budgetCents).toBe(0);
  });

  it("sin rubros cargados devuelve todo como sin asignar", () => {
    const summary = summarizeBudget({
      incomes: [income(100_000)],
      allocations: [],
      expenses: [],
    });

    expect(summary.slices).toEqual([]);
    expect(summary.unassignedBp).toBe(10_000);
    expect(summary.unassignedCents).toBe(100_000);
  });
});

describe("expenseStatus", () => {
  const today = "2026-09-10";

  it("con fecha de pago está pagado, aunque haya vencido antes", () => {
    expect(
      expenseStatus(expense(1000, { due_date: "2026-08-01", paid_on: "2026-08-03" }), today),
    ).toBe("pagado");
  });

  it("distingue vencido, por vencer y pendiente", () => {
    expect(expenseStatus(expense(1000, { due_date: "2026-09-09" }), today)).toBe("vencido");
    expect(expenseStatus(expense(1000, { due_date: "2026-09-10" }), today)).toBe("por-vencer");
    expect(expenseStatus(expense(1000, { due_date: "2026-09-15" }), today)).toBe("por-vencer");
    expect(expenseStatus(expense(1000, { due_date: "2026-09-16" }), today)).toBe("pendiente");
  });

  it("lo que vence hoy no está vencido", () => {
    expect(expenseStatus(expense(1000, { due_date: today }), today)).not.toBe("vencido");
  });
});

describe("totalsFor", () => {
  it("separa lo vencido de lo que todavía no", () => {
    const totals = totalsFor(
      [
        expense(10_000, { due_date: "2026-09-01" }),
        expense(20_000, { due_date: "2026-09-20" }),
        expense(30_000, { due_date: "2026-08-01", paid_on: "2026-08-02" }),
      ],
      "2026-09-10",
    );

    expect(totals.overdueCents).toBe(10_000);
    expect(totals.pendingCents).toBe(20_000);
    expect(totals.paidCents).toBe(30_000);
  });
});

describe("porcentajes", () => {
  it("los basis points nunca se muestran crudos", () => {
    expect(formatBp(3500)).toBe("35%");
    expect(formatBp(750)).toBe("7,5%");
    expect(formatBp(10_000)).toBe("100%");
  });

  it("parsea lo que se tipea, con coma o con punto", () => {
    expect(parsePercentToBp("35")).toBe(3500);
    expect(parsePercentToBp("7,5")).toBe(750);
    expect(parsePercentToBp("7.5")).toBe(750);
    expect(parsePercentToBp("35%")).toBe(3500);
  });

  it("rechaza lo que no es un porcentaje válido", () => {
    expect(parsePercentToBp("")).toBeNull();
    expect(parsePercentToBp("-5")).toBeNull();
    expect(parsePercentToBp("101")).toBeNull();
    expect(parsePercentToBp("abc")).toBeNull();
  });
});
