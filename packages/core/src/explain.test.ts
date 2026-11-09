import { describe, expect, it } from "vitest";
import { formatBRL, formatPercent } from "./money";
import { buildMonthSummary, type MonthSummaryInput } from "./explain";

const base: MonthSummaryInput = {
  monthLabel: "novembro de 2026",
  income: 500_000,
  taxReserve: 50_000,
  committed: 120_000,
  spent: 80_000,
  freeToSpend: 250_000,
  topCategories: [{ name: "Alimentação", amount: 30_000, share: 0.375 }],
  forecastBalance: 1_234_500,
  forecastMonths: 6,
  attention: [{ level: "warning", title: "Alimentação perto do limite" }],
};

describe("buildMonthSummary", () => {
  it("resume receita, reservas, gasto e disponível", () => {
    const text = buildMonthSummary(base);

    expect(text).toContain(`Em novembro de 2026, entraram ${formatBRL(500_000)}.`);
    expect(text).toContain(`reservados para imposto e ${formatBRL(120_000)} comprometidos com custos fixos`);
    expect(text).toContain(`${formatBRL(80_000)} já foram gastos`);
    expect(text).toContain(`${formatBRL(250_000)} livres`);
  });

  it("aponta o maior grupo de gasto com o percentual do resumo", () => {
    const text = buildMonthSummary(base);

    expect(text).toContain(`O maior grupo de gasto é Alimentação, com ${formatBRL(30_000)}`);
    expect(text).toContain(`${formatPercent(0.375, 0)} do que já saiu`);
  });

  it("avisa quando o disponível está negativo", () => {
    const text = buildMonthSummary({ ...base, freeToSpend: -1_500 });

    expect(text).toContain(`negativo em ${formatBRL(1_500)}`);
    expect(text).not.toContain("livres para o restante do mês");
  });

  it("não inventa reserva de imposto quando não houve receita", () => {
    const text = buildMonthSummary({ ...base, income: 0, taxReserve: 0, freeToSpend: -80_000 });

    expect(text).toContain("ainda não há receita registrada");
    expect(text).not.toContain("reservados para imposto");
  });

  it("inclui projeção, pendências e pontos de atenção", () => {
    const text = buildMonthSummary({
      ...base,
      forecastBalance: -2_000,
      pendingWrites: 2,
      attention: [
        { level: "danger", title: "Orçamento estourado: Mercado" },
        { level: "warning", title: "Reserva de emergência" },
      ],
    });

    expect(text).toContain(`saldo em 6 meses fica negativo em ${formatBRL(2_000)}`);
    expect(text).toContain("2 lançamentos aguardam sincronização");
    expect(text).toContain("Pontos de atenção: Orçamento estourado: Mercado; Reserva de emergência");
  });

  it("fecha com tranquilidade quando não há alerta", () => {
    const text = buildMonthSummary({ ...base, attention: [] });

    expect(text).toContain("Nenhum ponto crítico nos dados atuais.");
  });
});
