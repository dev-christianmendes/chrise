import { describe, expect, it } from "vitest";
import type { FinanceSnapshot } from "./insights";
import { buildPushReminders } from "./reminders";

const category = {
  id: "mercado",
  name: "Mercado",
  group: "alimentacao" as const,
  kind: "expense" as const,
  nature: "variable" as const,
  color: "hsl(var(--chart-2))",
};

const base = (overrides: Partial<FinanceSnapshot> = {}): FinanceSnapshot => ({
  month: "2026-11",
  categories: [category],
  accounts: [{ id: "a1", name: "Conta PJ", type: "checking", openingBalance: 0 }],
  transactions: [],
  budgets: [],
  taxProfile: { regime: "simples", activity: "ti_fator_r", proLabore: 162_100, extraReserveRate: 0.03 },
  ...overrides,
});

const revenue = (amount: number, date = "2026-10-05") => ({
  id: `t-${date}`,
  accountId: "a1",
  categoryId: "nf-servicos",
  kind: "income" as const,
  amount,
  description: "Nota fiscal",
  date,
  status: "paid" as const,
  recurrence: "none" as const,
  isBusinessRevenue: true,
});

const expense = (amount: number, date = "2026-11-05") => ({
  id: `e-${date}`,
  accountId: "a1",
  categoryId: "mercado",
  kind: "expense" as const,
  amount,
  description: "Mercado",
  date,
  status: "paid" as const,
  recurrence: "none" as const,
});

describe("buildPushReminders", () => {
  it("agenda o DAS três dias antes e calcula o valor no aparelho", () => {
    const reminders = buildPushReminders({
      today: "2026-11-09",
      snapshot: base({ transactions: [revenue(100_000)] }),
    });
    const first = reminders.find((reminder) => reminder.id === "das:2026-10");

    expect(first).toMatchObject({
      sendOn: "2026-11-17",
      url: "calendar",
      title: "DAS de Out/26",
    });
    expect(first?.body).toContain("Vence em 20/11/2026.");
    expect(first?.body).toContain("Valor estimado:");
  });

  it("avisa no mesmo dia quando o DAS já atrasou", () => {
    const reminders = buildPushReminders({
      today: "2026-11-25",
      snapshot: base({ transactions: [revenue(100_000)] }),
    });
    const overdue = reminders.find((reminder) => reminder.id === "das:2026-10");

    expect(overdue).toMatchObject({
      sendOn: "2026-11-25",
      title: "DAS em atraso (Out/26)",
    });
    expect(overdue?.body).toContain("Venceu em 20/11/2026.");
  });

  it("alerta orçamento a partir de 80% e no estouro", () => {
    const warning = buildPushReminders({
      today: "2026-11-09",
      snapshot: base({
        budgets: [{ id: "b1", categoryId: "mercado", month: "2026-11", limit: 50_000 }],
        transactions: [expense(45_000)],
      }),
    }).find((reminder) => reminder.id.startsWith("budget:"));

    expect(warning).toMatchObject({ url: "budgets", title: "Mercado perto do limite", sendOn: "2026-11-09" });
    expect(warning?.body).toMatch(/450,00.*500,00.*90%/);

    const over = buildPushReminders({
      today: "2026-11-09",
      snapshot: base({
        budgets: [{ id: "b1", categoryId: "mercado", month: "2026-11", limit: 50_000 }],
        transactions: [expense(60_000)],
      }),
    }).find((reminder) => reminder.id.startsWith("budget:"));

    expect(over?.id).toBe("budget:b1:2026-11:over");
    expect(over?.title).toBe("Orçamento estourado: Mercado");
  });

  it("não alerta orçamento abaixo do limite de aviso", () => {
    const reminders = buildPushReminders({
      today: "2026-11-09",
      snapshot: base({
        budgets: [{ id: "b1", categoryId: "mercado", month: "2026-11", limit: 50_000 }],
        transactions: [expense(30_000)],
      }),
    });

    expect(reminders.some((reminder) => reminder.id.startsWith("budget:"))).toBe(false);
  });
});
