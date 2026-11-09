import { addDays, monthLabel } from "./dates";
import { buildFiscalCalendar } from "./fiscal-calendar";
import { simplesForMonth, type FinanceSnapshot } from "./insights";
import { budgetStatus } from "./metrics";
import { formatBRL } from "./money";
import type { ISODate } from "./types";

export const DAS_LEAD_DAYS = 3;
export const BUDGET_ALERT_THRESHOLD = 0.8;
export const MAX_PUSH_REMINDERS = 48;

export interface PushReminder {
  /** Chave estável: evita repetir o mesmo aviso no servidor. */
  id: string;
  title: string;
  body: string;
  /** Rota relativa ao escopo do PWA, para funcionar também no GitHub Pages. */
  url: string;
  sendOn: ISODate;
}

export interface ReminderInput {
  today: ISODate;
  snapshot: FinanceSnapshot;
  monthsAhead?: number;
  dasLeadDays?: number;
  budgetThreshold?: number;
}

const dateBR = (iso: ISODate): string => iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4);

/**
 * Calcula no aparelho o que deve virar notificação. O servidor não lê
 * lançamentos: ele só entrega os lembretes já calculados e agendados.
 */
export function buildPushReminders({
  today,
  snapshot,
  monthsAhead = 12,
  dasLeadDays = DAS_LEAD_DAYS,
  budgetThreshold = BUDGET_ALERT_THRESHOLD,
}: ReminderInput): PushReminder[] {
  const reminders = new Map<string, PushReminder>();
  const threshold = Math.min(Math.max(budgetThreshold, 0), 1);

  const events = buildFiscalCalendar({
    today,
    months: monthsAhead,
    lookbackDays: 30,
    dasAmountFor: (referenceMonth) => {
      const das = simplesForMonth(snapshot, referenceMonth).das;
      return das > 0 ? das : undefined;
    },
  });

  for (const event of events) {
    if (event.kind !== "das") continue;
    const referenceMonth = event.id.slice("das:".length);
    const sendOn = event.status === "overdue" ? today : addDays(event.dueDate, -Math.max(dasLeadDays, 0));
    const when = sendOn < today ? today : sendOn;
    const label = monthLabel(referenceMonth);
    const amount = event.amount !== undefined ? ` Valor estimado: ${formatBRL(event.amount)}.` : "";
    const overdue = event.status === "overdue";

    reminders.set(`das:${referenceMonth}`, {
      id: `das:${referenceMonth}`,
      title: overdue ? `DAS em atraso (${label})` : `DAS de ${label}`,
      body: overdue ? `Venceu em ${dateBR(event.dueDate)}.${amount}` : `Vence em ${dateBR(event.dueDate)}.${amount}`,
      url: "calendar",
      sendOn: when,
    });
  }

  const categoryName = new Map(snapshot.categories.map((category) => [category.id, category.name]));
  for (const budget of snapshot.budgets.filter((item) => item.month === snapshot.month)) {
    const status = budgetStatus(budget, snapshot.transactions);
    if (status.level === "ok" || status.ratio < threshold) continue;

    const name = categoryName.get(budget.categoryId) ?? budget.categoryId;
    const over = status.level === "over";
    reminders.set(`budget:${budget.id}:${budget.month}:${status.level}`, {
      id: `budget:${budget.id}:${budget.month}:${status.level}`,
      title: over ? `Orçamento estourado: ${name}` : `${name} perto do limite`,
      body: `${formatBRL(status.spent)} de ${formatBRL(budget.limit)} (${Math.round(status.ratio * 100)}%).`,
      url: "budgets",
      sendOn: today,
    });
  }

  return [...reminders.values()].sort((a, b) => a.sendOn.localeCompare(b.sendOn) || a.id.localeCompare(b.id)).slice(0, MAX_PUSH_REMINDERS);
}
