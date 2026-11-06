import { describe, expect, it } from "vitest";
import { monthlyAllowance } from "./allowance";
import { simplesForMonth, type FinanceSnapshot } from "./insights";
import type { Category, Transaction } from "./types";

const categories: Category[] = [
  { id: "nf", name: "NF", group: "receita", kind: "income", nature: "fixed", color: "" },
  { id: "aluguel", name: "Aluguel", group: "moradia", kind: "expense", nature: "fixed", color: "" },
  { id: "mercado", name: "Mercado", group: "alimentacao", kind: "expense", nature: "variable", color: "" },
];

let seq = 0;
const tx = (p: Partial<Transaction>): Transaction => ({
  id: String(++seq), accountId: "a", categoryId: "mercado", kind: "expense", amount: 0,
  description: "", date: "2026-11-01", status: "paid", recurrence: "none", ...p,
});

const snap = (transactions: Transaction[]): FinanceSnapshot => ({
  month: "2026-11",
  transactions,
  categories,
  accounts: [],
  budgets: [],
  taxProfile: { regime: "simples", activity: "ti_fator_r", proLabore: 151_800, extraReserveRate: 0.03 },
});

describe("monthlyAllowance", () => {
  const transactions = [
    tx({ kind: "income", categoryId: "nf", amount: 1_000_000, date: "2026-11-05", isBusinessRevenue: true }),
    tx({ categoryId: "mercado", amount: 50_000, date: "2026-11-03" }),
    // fixa ainda não paga: compromete o mês
    tx({ categoryId: "aluguel", amount: 300_000, date: "2026-11-25", status: "pending" }),
    // variável futura (previsão): NÃO desconta, é o que o "livre" cobre
    tx({ categoryId: "mercado", amount: 80_000, date: "2026-11-26", status: "pending" }),
    // outro mês: ignorado
    tx({ categoryId: "mercado", amount: 999_999, date: "2026-10-30" }),
  ];

  it("receita − imposto a separar − gasto − fixos pendentes", () => {
    const s = snap(transactions);
    const a = monthlyAllowance(s, "2026-11-06");
    const reserve = simplesForMonth(s).totalReserve;
    expect(a).toMatchObject({ income: 1_000_000, spent: 50_000, committed: 300_000, taxReserve: reserve });
    expect(a.free).toBe(1_000_000 - reserve - 50_000 - 300_000);
  });

  it("divide pelos dias restantes contando hoje", () => {
    const a = monthlyAllowance(snap(transactions), "2026-11-06");
    expect(a.daysLeft).toBe(25); // 6..30
    expect(a.perDay).toBe(Math.floor(a.free / 25));
    expect(a.monthProgress).toBeCloseTo(6 / 30);
  });

  it("no último dia ainda sobra 1 dia; sem saldo livre, perDay é 0", () => {
    const s = snap([tx({ amount: 10_000, date: "2026-11-02" })]);
    const a = monthlyAllowance(s, "2026-11-30");
    expect(a.daysLeft).toBe(1);
    // Sem faturamento ainda há o INSS do pró-labore a reservar.
    expect(a.free).toBe(-10_000 - simplesForMonth(s).inss);
    expect(a.perDay).toBe(0);
    expect(a.spentRatio).toBe(1);
  });
});
