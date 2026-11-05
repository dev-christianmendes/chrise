import { describe, expect, it } from "vitest";
import { detectAnomalies, monthlySeries, summarizeMonth, toYearMonth } from "@chrise/core";
import { DEFAULT_CATEGORIES } from "../categories";
import { generateMockDataset } from "./generate";

const opts = { endMonth: "2026-11", today: "2026-11-05" };

describe("generateMockDataset", () => {
  it("é determinístico", () => {
    expect(generateMockDataset(opts)).toEqual(generateMockDataset(opts));
  });

  it("gera 24 meses e só usa categorias existentes", () => {
    const { transactions } = generateMockDataset(opts);
    const months = new Set(transactions.map((t) => toYearMonth(t.date)));
    expect(months.size).toBe(24);
    const ids = new Set(DEFAULT_CATEGORIES.map((c) => c.id));
    expect(transactions.every((t) => ids.has(t.categoryId))).toBe(true);
    expect(transactions.every((t) => Number.isInteger(t.amount) && t.amount > 0)).toBe(true);
  });

  it("lançamentos depois de hoje ficam pendentes", () => {
    const { transactions } = generateMockDataset(opts);
    const future = transactions.filter((t) => t.date > opts.today);
    expect(future.length).toBeGreaterThan(0);
    expect(future.every((t) => t.status === "pending")).toBe(true);
  });

  it("a persona fecha os meses no positivo, na maior parte das vezes", () => {
    const { transactions } = generateMockDataset(opts);
    const positives = monthlySeries(transactions, "2026-10", 23).filter((m) => m.balance > 0);
    expect(positives.length).toBeGreaterThanOrEqual(20);
    expect(summarizeMonth(transactions, "2026-10").savingsRate).toBeLessThan(0.6);
  });

  it("o gasto do notebook aparece como anomalia em 'outros'", () => {
    const { transactions } = generateMockDataset(opts);
    const series = monthlySeries(transactions, "2026-11", 24).map((m) => m.expense);
    expect(detectAnomalies(series, 3).length).toBeGreaterThan(0);
  });
});
