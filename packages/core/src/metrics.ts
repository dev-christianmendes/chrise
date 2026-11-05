import { lastMonths, toYearMonth } from "./dates";
import { sum } from "./money";
import type { Budget, Category, Cents, Transaction, YearMonth } from "./types";

export interface MonthSummary {
  month: YearMonth;
  income: Cents;
  expense: Cents;
  balance: Cents;
  /** (receita − despesa) / receita. 0 quando não há receita. */
  savingsRate: number;
}

const inMonth = (month: YearMonth) => (t: Transaction) => toYearMonth(t.date) === month;

export function summarizeMonth(transactions: readonly Transaction[], month: YearMonth): MonthSummary {
  const txs = transactions.filter(inMonth(month));
  const income = sum(txs.filter((t) => t.kind === "income").map((t) => t.amount));
  const expense = sum(txs.filter((t) => t.kind === "expense").map((t) => t.amount));
  const balance = income - expense;
  return { month, income, expense, balance, savingsRate: income > 0 ? balance / income : 0 };
}

/** Série mensal dos últimos `n` meses terminando em `end`. */
export function monthlySeries(
  transactions: readonly Transaction[],
  end: YearMonth,
  n: number,
): MonthSummary[] {
  return lastMonths(end, n).map((m) => summarizeMonth(transactions, m));
}

export interface CategorySlice {
  category: Category;
  total: Cents;
  share: number;
}

export function expensesByCategory(
  transactions: readonly Transaction[],
  categories: readonly Category[],
  month: YearMonth,
): CategorySlice[] {
  const totals = new Map<string, Cents>();
  for (const t of transactions) {
    if (t.kind !== "expense" || toYearMonth(t.date) !== month) continue;
    totals.set(t.categoryId, (totals.get(t.categoryId) ?? 0) + t.amount);
  }
  const grand = sum([...totals.values()]);
  const byId = new Map(categories.map((c) => [c.id, c]));
  return [...totals.entries()]
    .flatMap(([id, total]) => {
      const category = byId.get(id);
      return category ? [{ category, total, share: grand > 0 ? total / grand : 0 }] : [];
    })
    .sort((a, b) => b.total - a.total);
}

export interface NatureSplit {
  fixed: Cents;
  variable: Cents;
  fixedShare: number;
}

export function fixedVsVariable(
  transactions: readonly Transaction[],
  categories: readonly Category[],
  month: YearMonth,
): NatureSplit {
  const nature = new Map(categories.map((c) => [c.id, c.nature]));
  let fixed = 0;
  let variable = 0;
  for (const t of transactions) {
    if (t.kind !== "expense" || toYearMonth(t.date) !== month) continue;
    if (nature.get(t.categoryId) === "fixed") fixed += t.amount;
    else variable += t.amount;
  }
  const total = fixed + variable;
  return { fixed, variable, fixedShare: total > 0 ? fixed / total : 0 };
}

/** Quantos meses o saldo atual cobre a despesa média. Infinity se não houver despesa. */
export function runwayMonths(liquidBalance: Cents, avgMonthlyExpense: Cents): number {
  if (avgMonthlyExpense <= 0) return Infinity;
  return Math.max(0, liquidBalance / avgMonthlyExpense);
}

/** Meta de reserva de emergência: N meses do custo FIXO médio (6 por padrão; PJ deveria mirar 6–12). */
export function emergencyFundTarget(avgFixedExpense: Cents, months = 6): Cents {
  return avgFixedExpense * months;
}

export type BudgetLevel = "ok" | "warning" | "over";

export interface BudgetStatus {
  budget: Budget;
  spent: Cents;
  ratio: number;
  level: BudgetLevel;
  remaining: Cents;
}

export function budgetStatus(budget: Budget, transactions: readonly Transaction[]): BudgetStatus {
  const spent = sum(
    transactions
      .filter((t) => t.kind === "expense" && t.categoryId === budget.categoryId && toYearMonth(t.date) === budget.month)
      .map((t) => t.amount),
  );
  const ratio = budget.limit > 0 ? spent / budget.limit : 0;
  const level: BudgetLevel = ratio > 1 ? "over" : ratio >= 0.8 ? "warning" : "ok";
  return { budget, spent, ratio, level, remaining: budget.limit - spent };
}

/** Saldo atual = saldos iniciais + receitas − despesas já pagas. */
export function currentBalance(
  openingBalances: readonly Cents[],
  transactions: readonly Transaction[],
): Cents {
  let total = sum(openingBalances);
  for (const t of transactions) {
    if (t.status !== "paid") continue;
    total += t.kind === "income" ? t.amount : -t.amount;
  }
  return total;
}
