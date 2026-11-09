import { formatBRL, formatPercent } from "./money";
import type { Cents } from "./types";

/**
 * Contrato do resumo explicado. Tudo aqui é agregado: a IA nunca recebe
 * lançamento individual, descrição ou dado pessoal.
 *
 * Os números do texto são os mesmos do resumo determinístico; a Edge Function
 * rejeita qualquer resposta que invente um número fora deste payload.
 */
export interface SummaryCategory {
  name: string;
  amount: Cents;
  share: number;
}

export interface SummaryAttention {
  level: "warning" | "danger";
  title: string;
}

export interface MonthSummaryInput {
  monthLabel: string;
  income: Cents;
  taxReserve: Cents;
  committed: Cents;
  spent: Cents;
  freeToSpend: Cents;
  topCategories: SummaryCategory[];
  forecastBalance: Cents;
  forecastMonths: number;
  attention: SummaryAttention[];
  pendingWrites?: number;
}

/**
 * Resumo determinístico do mês. É a fonte de verdade dos números: a versão
 * "com IA" só pode reescrever este texto, nunca produzir valores novos.
 */
export function buildMonthSummary(input: MonthSummaryInput): string {
  const parts: string[] = [];

  parts.push(
    input.income > 0
      ? `Em ${input.monthLabel}, entraram ${formatBRL(input.income)}.`
      : `Em ${input.monthLabel}, ainda não há receita registrada.`,
  );

  if (input.income > 0) {
    parts.push(
      `Desse total, ${formatBRL(input.taxReserve)} estão reservados para imposto e ${formatBRL(input.committed)} comprometidos com custos fixos.`,
    );
  }

  parts.push(
    input.freeToSpend < 0
      ? `Com ${formatBRL(input.spent)} já gastos, o disponível do mês está negativo em ${formatBRL(Math.abs(input.freeToSpend))}: segure os gastos variáveis.`
      : `Até agora, ${formatBRL(input.spent)} já foram gastos, deixando ${formatBRL(input.freeToSpend)} livres para o restante do mês.`,
  );

  const top = input.topCategories[0];
  if (top) {
    parts.push(
      `O maior grupo de gasto é ${top.name}, com ${formatBRL(top.amount)} (${formatPercent(top.share, 0)} do que já saiu).`,
    );
  }

  parts.push(
    input.forecastBalance < 0
      ? `No ritmo atual, o saldo em ${input.forecastMonths} meses fica negativo em ${formatBRL(Math.abs(input.forecastBalance))}.`
      : `No ritmo atual, o saldo em ${input.forecastMonths} meses fica em ${formatBRL(input.forecastBalance)}.`,
  );

  if (input.pendingWrites && input.pendingWrites > 0) {
    parts.push(
      input.pendingWrites === 1
        ? "1 lançamento aguarda sincronização."
        : `${input.pendingWrites} lançamentos aguardam sincronização.`,
    );
  }

  parts.push(
    input.attention.length > 0
      ? `Pontos de atenção: ${input.attention.map((item) => item.title).join("; ")}.`
      : "Nenhum ponto crítico nos dados atuais.",
  );

  return parts.join(" ");
}
