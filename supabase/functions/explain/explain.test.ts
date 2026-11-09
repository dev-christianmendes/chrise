import { describe, expect, it } from "vitest";
import { buildMonthSummary, type MonthSummaryInput as CoreMonthSummaryInput } from "@chrise/core";
import {
  EXPLAIN_PROMPT_VERSION,
  buildPrompt,
  isSafeExplanation,
  numericTokens,
  parseSummaryInput,
  type MonthSummaryInput,
} from "./explain";

const sample: MonthSummaryInput = {
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
  pendingWrites: 0,
};

/** Garante em tempo de compilação que o contrato da função espelha o do core. */
const contract: CoreMonthSummaryInput = sample;
void contract;

describe("parseSummaryInput", () => {
  it("aceita o payload do resumo", () => {
    expect(parseSummaryInput(sample)).toEqual(sample);
  });

  it("rejeita formatos fora do contrato", () => {
    expect(parseSummaryInput(null)).toBeNull();
    expect(parseSummaryInput([])).toBeNull();
    expect(parseSummaryInput({})).toBeNull();
    expect(parseSummaryInput({ ...sample, income: 12.5 })).toBeNull();
    expect(parseSummaryInput({ ...sample, forecastMonths: 0 })).toBeNull();
    expect(parseSummaryInput({ ...sample, topCategories: [{ name: "x", amount: 1, share: 2 }] })).toBeNull();
    expect(parseSummaryInput({ ...sample, attention: [{ level: "info", title: "x" }] })).toBeNull();
    expect(parseSummaryInput({ ...sample, pendingWrites: -1 })).toBeNull();
    expect(parseSummaryInput({ ...sample, topCategories: new Array(7).fill(sample.topCategories[0]) })).toBeNull();
  });

  it("remove espaços das pontas e limita o texto", () => {
    const parsed = parseSummaryInput({ ...sample, monthLabel: "  novembro de 2026  " });
    expect(parsed?.monthLabel).toBe("novembro de 2026");
    expect(parseSummaryInput({ ...sample, monthLabel: "x".repeat(81) })).toBeNull();
  });
});

describe("buildPrompt", () => {
  it("versiona o prompt e envia só os fatos formatados", () => {
    const { system, user } = buildPrompt(sample);

    expect(system).toContain(EXPLAIN_PROMPT_VERSION);
    expect(system).toContain("Não calcule");
    expect(user).toContain("novembro de 2026");
    expect(user.replace(/\u00a0/g, " ")).toContain("R$ 5.000,00");
    expect(user).toContain("Alimentação");
  });
});

describe("isSafeExplanation", () => {
  it("aceita o resumo determinístico do core", () => {
    expect(isSafeExplanation(buildMonthSummary(sample), sample)).toBe(true);
  });

  it("aceita variações com os mesmos números, inclusive negativos", () => {
    const negative = { ...sample, freeToSpend: -1_500, forecastBalance: -2_000, pendingWrites: 2 };
    expect(isSafeExplanation(buildMonthSummary(negative), negative)).toBe(true);
  });

  it("rejeita número que não existe no payload", () => {
    const text = "Em novembro de 2026, entraram R$ 9.999,00 e o mês fechou com folga para o negócio.";
    expect(isSafeExplanation(text, sample)).toBe(false);
  });

  it("rejeita texto curto demais", () => {
    expect(isSafeExplanation("Sobrou R$ 2.500,00.", sample)).toBe(false);
  });
});

describe("numericTokens", () => {
  it("extrai valores no formato brasileiro", () => {
    expect(numericTokens("R$ 1.234,56 e 38,5% em 2026")).toEqual(["1.234,56", "38,5", "2026"]);
  });
});
