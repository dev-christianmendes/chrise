import { formatBRL, type Cents, type ISODate } from "@chrise/core";

/** "R$ 1.234,56" → ["R$ 1.234", ",56"]: o inteiro em destaque, centavos discretos. */
export function splitBRL(cents: Cents): [string, string] {
  // Mantém o espaço não separável do Intl: "R$" nunca quebra linha longe do número.
  const s = formatBRL(cents);
  const i = s.lastIndexOf(",");
  return i < 0 ? [s, ""] : [s.slice(0, i), s.slice(i)];
}

const pad = (n: number) => String(n).padStart(2, "0");
export const todayISO = (now = new Date()): ISODate => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

const WEEKDAY = new Intl.DateTimeFormat("pt-BR", { weekday: "long" });
const DAY_MONTH = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" });

/** "Hoje", "Ontem", "segunda-feira", "3 de nov." — como as pessoas falam de datas recentes. */
export function relativeDay(date: ISODate, today: ISODate = todayISO()): string {
  const d = new Date(`${date}T12:00:00`);
  const t = new Date(`${today}T12:00:00`);
  const diff = Math.round((t.getTime() - d.getTime()) / 86_400_000);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Ontem";
  if (diff === -1) return "Amanhã";
  if (diff > 1 && diff < 7) {
    const w = WEEKDAY.format(d);
    return w.charAt(0).toUpperCase() + w.slice(1);
  }
  return DAY_MONTH.format(d).replace(" de ", " ");
}

const MONTH_LONG = new Intl.DateTimeFormat("pt-BR", { month: "long" });
export const monthName = (ym: string) => MONTH_LONG.format(new Date(`${ym}-15T12:00:00`));

export const greeting = (now = new Date()) => {
  const h = now.getHours();
  return h < 5 ? "Boa madrugada" : h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
};
