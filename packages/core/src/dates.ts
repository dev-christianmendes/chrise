import type { ISODate, YearMonth } from "./types";

export const toYearMonth = (date: ISODate): YearMonth => date.slice(0, 7);

export const addMonths = (ym: YearMonth, n: number): YearMonth => {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  const idx = y * 12 + (m - 1) + n;
  const year = Math.floor(idx / 12);
  const month = (idx % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
};

/** Lista de meses de `from` até `to`, inclusive. */
export const monthRange = (from: YearMonth, to: YearMonth): YearMonth[] => {
  const out: YearMonth[] = [];
  for (let ym = from; ym <= to; ym = addMonths(ym, 1)) out.push(ym);
  return out;
};

/** Últimos `n` meses terminando em `end` (inclusive), em ordem cronológica. */
export const lastMonths = (end: YearMonth, n: number): YearMonth[] =>
  monthRange(addMonths(end, -(n - 1)), end);

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** "2026-11" -> "Nov/26" */
export const monthLabel = (ym: YearMonth): string => {
  const [y, m] = ym.split("-");
  return `${MONTH_LABELS[Number(m) - 1]}/${y!.slice(2)}`;
};

export const currentYearMonth = (now = new Date()): YearMonth =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
