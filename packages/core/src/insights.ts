import { addMonths, lastMonths, toYearMonth } from "./dates";
import { detectAnomalies, forecast, projectBalance } from "./forecast";
import { formatBRL, formatPercent } from "./money";
import {
  budgetStatus,
  currentBalance,
  emergencyFundTarget,
  fixedVsVariable,
  monthlySeries,
  summarizeMonth,
} from "./metrics";
import { calculateSimples, type SimplesResult } from "./tax/simples";
import type { Account, Budget, Category, Cents, TaxProfile, Transaction, YearMonth } from "./types";

export type InsightLevel = "positive" | "info" | "warning" | "danger";

export interface Insight {
  id: string;
  level: InsightLevel;
  title: string;
  message: string;
}

export interface FinanceSnapshot {
  month: YearMonth;
  transactions: readonly Transaction[];
  categories: readonly Category[];
  accounts: readonly Account[];
  budgets: readonly Budget[];
  taxProfile: TaxProfile;
}

/** Faturamento PJ por mês (para RBT12), do mais antigo ao mais recente. */
export function businessRevenueByMonth(transactions: readonly Transaction[], months: readonly YearMonth[]): Cents[] {
  return months.map((m) =>
    transactions
      .filter((t) => t.kind === "income" && t.isBusinessRevenue && toYearMonth(t.date) === m)
      .reduce((acc, t) => acc + t.amount, 0),
  );
}

export function simplesForMonth(snapshot: FinanceSnapshot): SimplesResult {
  const { month, transactions, taxProfile } = snapshot;
  const [current = 0] = businessRevenueByMonth(transactions, [month]);
  const history = businessRevenueByMonth(transactions, lastMonths(addMonths(month, -1), 12));
  // Descarta meses zerados ANTES do primeiro faturamento (início de atividade).
  const first = history.findIndex((x) => x > 0);
  const previous = first === -1 ? [] : history.slice(first);
  return calculateSimples({
    monthRevenue: current,
    previousRevenues: previous,
    proLabore: taxProfile.proLabore,
    extraReserveRate: taxProfile.extraReserveRate,
  });
}

/** Insights determinísticos, ordenados por severidade. */
export function buildInsights(snapshot: FinanceSnapshot): Insight[] {
  const { month, transactions, categories, accounts, budgets } = snapshot;
  const out: Insight[] = [];
  const catName = new Map(categories.map((c) => [c.id, c.name]));

  // 1. Fator R / Anexo
  const tax = simplesForMonth(snapshot);
  if (tax.rbt12 > 0 && tax.anexo === "V") {
    const saving = tax.das - tax.dasOtherAnexo;
    out.push({
      id: "fator-r",
      level: "danger",
      title: "Você está no Anexo V",
      message: `Fator R em ${formatPercent(tax.fatorR)}. Com pró-labore de ${formatBRL(tax.minProLaboreForAnexoIII)} você iria para o Anexo III e o DAS deste mês cairia ${formatBRL(saving)}, antes do INSS extra. Simule na aba Impostos.`,
    });
  }

  // 2. Orçamentos
  for (const b of budgets.filter((x) => x.month === month)) {
    const st = budgetStatus(b, transactions);
    const name = catName.get(b.categoryId) ?? b.categoryId;
    if (st.level === "over") {
      out.push({ id: `budget-${b.id}`, level: "danger", title: `Orçamento estourado: ${name}`, message: `Passou ${formatBRL(-st.remaining)} do limite de ${formatBRL(b.limit)}.` });
    } else if (st.level === "warning") {
      out.push({ id: `budget-${b.id}`, level: "warning", title: `${name} perto do limite`, message: `${formatPercent(st.ratio, 0)} usado; restam ${formatBRL(st.remaining)}.` });
    }
  }

  // 3. Projeção de saldo negativo nos próximos 6 meses
  const closed = monthlySeries(transactions, addMonths(month, -1), 12);
  const balance = currentBalance(accounts.map((a) => a.openingBalance), transactions);
  if (closed.some((m) => m.income > 0)) {
    const inc = forecast(closed.map((m) => m.income), { horizon: 6 });
    const exp = forecast(closed.map((m) => m.expense), { horizon: 6 });
    const proj = projectBalance(balance, inc, exp);
    const firstNegative = proj.find((p) => p.balance < 0);
    if (firstNegative) {
      out.push({ id: "forecast-negative", level: "danger", title: "Saldo projetado negativo", message: `No ritmo atual, o saldo fica negativo em ${firstNegative.step} ${firstNegative.step === 1 ? "mês" : "meses"}.` });
    } else if (proj.some((p) => p.low < 0)) {
      out.push({ id: "forecast-risk", level: "warning", title: "Risco no cenário pessimista", message: "No pior cenário dos próximos 6 meses o saldo encosta no zero. Vale reforçar a reserva." });
    }
  }

  // 4. Anomalia no último mês fechado, por categoria
  const window = lastMonths(addMonths(month, -1), 12);
  for (const c of categories.filter((x) => x.kind === "expense")) {
    const series = window.map((m) =>
      transactions.filter((t) => t.categoryId === c.id && t.kind === "expense" && toYearMonth(t.date) === m).reduce((a, t) => a + t.amount, 0),
    );
    if (series.filter((v) => v > 0).length < 4) continue;
    const last = detectAnomalies(series).find((a) => a.index === series.length - 1 && a.score > 0);
    if (last) {
      out.push({ id: `anomaly-${c.id}`, level: "warning", title: `Gasto atípico em ${c.name}`, message: `${formatBRL(last.value)} no mês passado, bem acima do seu padrão.` });
    }
  }

  // 5. Reserva de emergência (6 meses do custo fixo médio)
  const fixedAvg = Math.round(window.slice(-6).reduce((a, m) => a + fixedVsVariable(transactions, categories, m).fixed, 0) / 6);
  const target = emergencyFundTarget(fixedAvg, 6);
  if (fixedAvg > 0) {
    const coverage = balance / target;
    out.push(
      coverage >= 1
        ? { id: "emergency", level: "positive", title: "Reserva de emergência completa", message: `Seu saldo cobre ${formatPercent(coverage, 0)} da meta de ${formatBRL(target)}.` }
        : { id: "emergency", level: "info", title: "Reserva de emergência", message: `${formatPercent(Math.max(0, coverage), 0)} da meta de ${formatBRL(target)} (6× custo fixo). Como PJ, mire em 6 a 12 meses.` },
    );
  }

  // 6. Taxa de poupança do último mês fechado
  const prev = summarizeMonth(transactions, addMonths(month, -1));
  if (prev.income > 0) {
    if (prev.savingsRate >= 0.3) {
      out.push({ id: "savings", level: "positive", title: "Boa taxa de poupança", message: `Mês passado você guardou ${formatPercent(prev.savingsRate, 0)} da receita.` });
    } else if (prev.savingsRate < 0.1) {
      out.push({ id: "savings", level: "warning", title: "Taxa de poupança baixa", message: `Só ${formatPercent(Math.max(0, prev.savingsRate), 0)} da receita sobrou no mês passado.` });
    }
  }

  const order: Record<InsightLevel, number> = { danger: 0, warning: 1, info: 2, positive: 3 };
  return out.sort((a, b) => order[a.level] - order[b.level]);
}
