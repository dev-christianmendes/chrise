import { addMonths, monthLabel, toYearMonth } from "./dates";
import type { Cents, ISODate, YearMonth } from "./types";

export type FiscalEventKind = "das" | "defis" | "irpf";
export type FiscalEventStatus = "overdue" | "today" | "upcoming";

export interface FiscalEvent {
  id: string;
  kind: FiscalEventKind;
  title: string;
  dueDate: ISODate;
  referenceLabel: string;
  status: FiscalEventStatus;
  daysUntil: number;
  amount?: Cents;
  note: string;
}

export interface FiscalCalendarInput {
  today: ISODate;
  months: number;
  /** Janela para trás em dias, para mostrar vencimentos recém-atrasados. */
  lookbackDays?: number;
  dasAmountFor?: (referenceMonth: YearMonth) => Cents | undefined;
}

const pad = (n: number) => String(n).padStart(2, "0");

function parseISO(date: ISODate): [number, number, number] {
  const [y, m, d] = date.split("-").map(Number);
  return [y!, m!, d!];
}

function toISO(year: number, month: number, day: number): ISODate {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function daysBetween(from: ISODate, to: ISODate): number {
  const [fy, fm, fd] = parseISO(from);
  const [ty, tm, td] = parseISO(to);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

function addDays(date: ISODate, days: number): ISODate {
  const [y, m, d] = parseISO(date);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return toISO(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
}

function lastDayOfMonth(ym: YearMonth): ISODate {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  return toISO(y, m, new Date(Date.UTC(y, m, 0)).getUTCDate());
}

/** DAS da competência vence no dia 20 do mês seguinte. */
export const dasDueDate = (referenceMonth: YearMonth): ISODate => `${addMonths(referenceMonth, 1)}-20`;

/** Entrega da DEFIS no ano seguinte ao ano-base. */
export const defisDueDate = (deliveryYear: number): ISODate => `${deliveryYear}-03-31`;

/** Entrega da IRPF no ano seguinte ao exercício. */
export const irpfDueDate = (deliveryYear: number): ISODate => `${deliveryYear}-04-30`;

/**
 * Calendário fiscal determinístico. As datas são datas de referência (dia 20,
 * 31/03 e 30/04): feriados e prorrogações oficiais não são calculados.
 */
export function buildFiscalCalendar({
  today,
  months,
  lookbackDays = 30,
  dasAmountFor,
}: FiscalCalendarInput): FiscalEvent[] {
  const todayMonth = toYearMonth(today);
  const horizon = Math.min(Math.max(Math.trunc(months), 1), 24);
  const from = addDays(today, -Math.max(Math.trunc(lookbackDays), 0));
  const endMonth = addMonths(todayMonth, horizon);
  const end = lastDayOfMonth(endMonth);
  const events: FiscalEvent[] = [];

  const push = (event: Omit<FiscalEvent, "status" | "daysUntil">) => {
    if (event.dueDate < from || event.dueDate > end) return;
    const daysUntil = daysBetween(today, event.dueDate);
    events.push({
      ...event,
      daysUntil,
      status: daysUntil < 0 ? "overdue" : daysUntil === 0 ? "today" : "upcoming",
    });
  };

  for (let reference = addMonths(todayMonth, -1); reference <= endMonth; reference = addMonths(reference, 1)) {
    const amount = dasAmountFor?.(reference);
    push({
      id: `das:${reference}`,
      kind: "das",
      title: "DAS — Simples Nacional",
      dueDate: dasDueDate(reference),
      referenceLabel: `Competência ${monthLabel(reference)}`,
      amount: amount && amount > 0 ? amount : undefined,
      note: "Imposto do mês anterior; vencimento no dia 20.",
    });
  }

  const todayYear = Number(today.slice(0, 4));
  const endYear = Number(endMonth.slice(0, 4));
  for (let year = todayYear; year <= endYear + 1; year += 1) {
    push({
      id: `defis:${year}`,
      kind: "defis",
      title: "DEFIS",
      dueDate: defisDueDate(year),
      referenceLabel: `Ano-base ${year - 1}`,
      note: "Declaração anual do Simples Nacional.",
    });
    push({
      id: `irpf:${year}`,
      kind: "irpf",
      title: "IRPF",
      dueDate: irpfDueDate(year),
      referenceLabel: `Exercício ${year - 1}`,
      note: "Declaração de IRPF da pessoa física, se aplicável.",
    });
  }

  return events.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.kind.localeCompare(b.kind));
}
