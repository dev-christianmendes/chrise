import { describe, expect, it } from "vitest";
import { addMonths, lastMonths, monthLabel } from "./dates";
import {
  budgetStatus,
  currentBalance,
  expensesByCategory,
  fixedVsVariable,
  monthlySeries,
  runwayMonths,
  summarizeMonth,
} from "./metrics";
import type { Category, Transaction } from "./types";

const cat = (id: string, nature: "fixed" | "variable"): Category => ({
  id,
  name: id,
  group: "outros",
  kind: "expense",
  nature,
  color: "red",
});
const categories = [cat("aluguel", "fixed"), cat("ifood", "variable")];

let seq = 0;
const tx = (p: Partial<Transaction>): Transaction => ({
  id: String(++seq),
  accountId: "a",
  categoryId: "ifood",
  kind: "expense",
  amount: 0,
  description: "",
  date: "2026-10-10",
  status: "paid",
  recurrence: "none",
  ...p,
});

const txs: Transaction[] = [
  tx({ kind: "income", categoryId: "nf", amount: 1_000_000 }),
  tx({ categoryId: "aluguel", amount: 250_000 }),
  tx({ categoryId: "ifood", amount: 50_000 }),
  tx({ categoryId: "ifood", amount: 30_000, date: "2026-09-02" }),
];

describe("datas", () => {
  it("virada de ano", () => {
    expect(addMonths("2026-11", 3)).toBe("2027-02");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(lastMonths("2026-02", 3)).toEqual(["2025-12", "2026-01", "2026-02"]);
    expect(monthLabel("2026-11")).toBe("Nov/26");
  });
});

describe("métricas", () => {
  it("resumo do mês e taxa de poupança", () => {
    const s = summarizeMonth(txs, "2026-10");
    expect(s.income).toBe(1_000_000);
    expect(s.expense).toBe(300_000);
    expect(s.savingsRate).toBeCloseTo(0.7);
  });

  it("série mensal preenche meses vazios", () => {
    const s = monthlySeries(txs, "2026-10", 3);
    expect(s.map((m) => m.expense)).toEqual([0, 30_000, 300_000]);
  });

  it("despesas por categoria ordenadas", () => {
    const s = expensesByCategory(txs, categories, "2026-10");
    expect(s[0]!.category.id).toBe("aluguel");
    expect(s[0]!.share).toBeCloseTo(250 / 300);
  });

  it("fixo x variável", () => {
    expect(fixedVsVariable(txs, categories, "2026-10").fixed).toBe(250_000);
  });

  it("orçamento estourado", () => {
    const st = budgetStatus({ id: "b", categoryId: "ifood", month: "2026-10", limit: 40_000 }, txs);
    expect(st.level).toBe("over");
    expect(st.remaining).toBe(-10_000);
  });

  it("saldo ignora pendentes", () => {
    const withPending = [...txs, tx({ amount: 999_999, status: "pending" })];
    expect(currentBalance([100_000], withPending)).toBe(100_000 + 1_000_000 - 330_000);
  });

  it("runway", () => {
    expect(runwayMonths(600_000, 200_000)).toBe(3);
    expect(runwayMonths(1, 0)).toBe(Infinity);
  });
});
