import { toYearMonth } from "./dates";
import { simplesForMonth, type FinanceSnapshot } from "./insights";
import type { Cents, ISODate } from "./types";

/**
 * "Livre para gastar": a resposta do dia a dia.
 *
 *   receitas do mês (recebidas + previstas)
 * − imposto a separar sobre o faturamento do mês (DAS + INSS + reserva extra,
 *   que vencem no mês seguinte)
 * − despesas já pagas no mês
 * − contas FIXAS ainda pendentes no mês (aluguel, DAS do mês anterior, plano…)
 * = livre
 *
 * Gastos variáveis futuros não entram: são justamente o que o "livre" cobre.
 */
export interface Allowance {
  income: Cents;
  taxReserve: Cents;
  spent: Cents;
  committed: Cents;
  free: Cents;
  /** Dias restantes no mês, contando hoje. */
  daysLeft: number;
  /** Quanto dá para gastar por dia até o fim do mês (0 se `free` ≤ 0). */
  perDay: Cents;
  /** Fração do mês já decorrida (0–1), para comparar com o ritmo de gasto. */
  monthProgress: number;
  /** Fração do disponível (receita − imposto − fixos) já gasta. */
  spentRatio: number;
}

const daysInMonth = (ym: string) => {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

export function monthlyAllowance(snapshot: FinanceSnapshot, today: ISODate): Allowance {
  const { month, transactions, categories } = snapshot;
  const nature = new Map(categories.map((c) => [c.id, c.nature]));
  const txs = transactions.filter((t) => toYearMonth(t.date) === month);

  let income = 0;
  let spent = 0;
  let committed = 0;
  for (const t of txs) {
    if (t.kind === "income") income += t.amount;
    else if (t.status === "paid" && t.date <= today) spent += t.amount;
    else if (nature.get(t.categoryId) === "fixed") committed += t.amount;
  }

  const taxReserve = simplesForMonth(snapshot).totalReserve;
  const free = income - taxReserve - spent - committed;

  const total = daysInMonth(month);
  const day = toYearMonth(today) === month ? Number(today.slice(8, 10)) : today < month ? 0 : total;
  const daysLeft = Math.max(1, total - day + 1);
  const available = income - taxReserve - committed;

  return {
    income,
    taxReserve,
    spent,
    committed,
    free,
    daysLeft,
    perDay: free > 0 ? Math.floor(free / daysLeft) : 0,
    monthProgress: Math.min(1, day / total),
    spentRatio: available > 0 ? spent / available : spent > 0 ? 1 : 0,
  };
}
