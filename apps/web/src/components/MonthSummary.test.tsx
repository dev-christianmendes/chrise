import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { buildMonthSummary, type MonthSummaryInput } from "@chrise/core";
import { MonthSummary } from "./MonthSummary";

const input: MonthSummaryInput = {
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

describe("MonthSummary", () => {
  it("mostra o resumo calculado localmente", () => {
    render(<MonthSummary input={input} />);

    expect(screen.getByRole("heading", { name: "Resumo do mês" })).toBeInTheDocument();
    expect(screen.getByText(/Em novembro de 2026/).textContent).toBe(buildMonthSummary(input));
    expect(screen.getByText("Calculado a partir dos seus números.")).toBeInTheDocument();
  });

  it("não oferece IA na demo", () => {
    render(<MonthSummary input={input} />);

    expect(screen.queryByRole("button", { name: /IA/ })).not.toBeInTheDocument();
  });
});
