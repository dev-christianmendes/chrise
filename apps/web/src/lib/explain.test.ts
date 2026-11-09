import { describe, expect, it } from "vitest";
import type { MonthSummaryInput } from "@chrise/core";
import { requestExplanation } from "./explain";

const input: MonthSummaryInput = {
  monthLabel: "novembro de 2026",
  income: 0,
  taxReserve: 0,
  committed: 0,
  spent: 0,
  freeToSpend: 0,
  topCategories: [],
  forecastBalance: 0,
  forecastMonths: 6,
  attention: [],
};

describe("requestExplanation", () => {
  it("não chama a Edge Function na demo", async () => {
    await expect(requestExplanation(input)).resolves.toBeNull();
  });
});
