import { describe, expect, it } from "vitest";
import { buildInsights, simplesForMonth, type FinanceSnapshot } from "./insights";
import type { Category, Transaction } from "./types";

const categories: Category[] = [
  { id: "nf", name: "NF", group: "receita", kind: "income", nature: "fixed", color: "" },
  { id: "aluguel", name: "Aluguel", group: "moradia", kind: "expense", nature: "fixed", color: "" },
  { id: "delivery", name: "Delivery", group: "alimentacao", kind: "expense", nature: "variable", color: "" },
];

let seq = 0;
const tx = (p: Partial<Transaction>): Transaction => ({
  id: String(++seq), accountId: "a", categoryId: "aluguel", kind: "expense", amount: 0,
  description: "", date: "2026-01-10", status: "paid", recurrence: "none", ...p,
});

const months = Array.from({ length: 13 }, (_, i) => `2025-${String(i + 1).padStart(2, "0")}`.replace("2025-13", "2026-01"));
const base: Transaction[] = months.flatMap((m) => [
  tx({ kind: "income", categoryId: "nf", amount: 2_000_000, date: `${m}-05`, isBusinessRevenue: true }),
  tx({ categoryId: "aluguel", amount: 300_000, date: `${m}-08` }),
  tx({ categoryId: "delivery", amount: 40_000, date: `${m}-15` }),
]);

const snap = (p: Partial<FinanceSnapshot> = {}): FinanceSnapshot => ({
  month: "2026-01",
  transactions: base,
  categories,
  accounts: [{ id: "a", name: "PF", type: "checking", openingBalance: 0 }],
  budgets: [],
  taxProfile: { regime: "simples", activity: "ti_fator_r", proLabore: 151_800, extraReserveRate: 0 },
  ...p,
});

describe("simplesForMonth", () => {
  it("usa o faturamento PJ dos 12 meses anteriores", () => {
    const r = simplesForMonth(snap());
    expect(r.rbt12).toBe(24_000_000);
    expect(r.anexo).toBe("V");
  });
});

describe("buildInsights", () => {
  it("alerta Anexo V primeiro, com pró-labore sugerido", () => {
    const [first] = buildInsights(snap());
    expect(first!.id).toBe("fator-r");
    expect(first!.message).toContain("5.600");
  });

  it("sem alerta de anexo quando o Fator R está ok", () => {
    const ins = buildInsights(snap({ taxProfile: { regime: "simples", activity: "ti_fator_r", proLabore: 560_000, extraReserveRate: 0 } }));
    expect(ins.find((i) => i.id === "fator-r")).toBeUndefined();
  });

  it("orçamento estourado vira insight danger", () => {
    const ins = buildInsights(snap({ budgets: [{ id: "b", categoryId: "delivery", month: "2026-01", limit: 10_000 }] }));
    expect(ins.find((i) => i.id === "budget-b")?.level).toBe("danger");
  });

  it("detecta gasto atípico no último mês fechado", () => {
    const spike = tx({ categoryId: "delivery", amount: 400_000, date: "2025-12-20" });
    const ins = buildInsights(snap({ transactions: [...base, spike] }));
    expect(ins.some((i) => i.id === "anomaly-delivery")).toBe(true);
  });

  it("taxa de poupança alta é positiva", () => {
    expect(buildInsights(snap()).find((i) => i.id === "savings")?.level).toBe("positive");
  });
});
