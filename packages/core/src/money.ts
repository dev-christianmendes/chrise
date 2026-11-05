import type { Cents } from "./types";

/** Converte reais (ex.: 12.34) em centavos inteiros, arredondando corretamente. */
export const toCents = (reais: number): Cents => Math.round(reais * 100);

export const toReais = (cents: Cents): number => cents / 100;

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brlCompact = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Formata centavos como "R$ 1.234,56". */
export const formatBRL = (cents: Cents): string => brl.format(cents / 100);

/** Formata centavos de forma compacta para eixos de gráfico: "R$ 12,3 mil". */
export const formatBRLCompact = (cents: Cents): string => brlCompact.format(cents / 100);

/** Multiplica centavos por uma taxa e arredonda para centavo. */
export const applyRate = (cents: Cents, rate: number): Cents => Math.round(cents * rate);

export const sum = (values: readonly Cents[]): Cents => values.reduce((acc, v) => acc + v, 0);

/** Formata um número 0–1 como porcentagem "12,3%". */
export const formatPercent = (ratio: number, digits = 1): string =>
  new Intl.NumberFormat("pt-BR", {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(ratio);
