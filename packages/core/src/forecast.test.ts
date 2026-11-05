import { describe, expect, it } from "vitest";
import {
  annualToMonthlyRate,
  detectAnomalies,
  forecast,
  futureValue,
  linearRegression,
  monthsToGoal,
  projectBalance,
  seasonalIndices,
  weightedMovingAverage,
} from "./forecast";

describe("linearRegression", () => {
  it("reta perfeita tem R² = 1", () => {
    const r = linearRegression([10, 20, 30, 40]);
    expect(r.slope).toBeCloseTo(10);
    expect(r.intercept).toBeCloseTo(10);
    expect(r.r2).toBeCloseTo(1);
  });

  it("série vazia ou unitária não explode", () => {
    expect(linearRegression([])).toEqual({ slope: 0, intercept: 0, r2: 0 });
    expect(linearRegression([5]).intercept).toBe(5);
  });
});

describe("weightedMovingAverage", () => {
  it("dá mais peso aos valores recentes", () => {
    // (10*1 + 20*2 + 30*3) / 6 = 23.33
    expect(weightedMovingAverage([10, 20, 30], 3)).toBeCloseTo(23.333, 2);
  });
});

describe("seasonalIndices", () => {
  it("com menos de 2 ciclos fica neutro", () => {
    expect(seasonalIndices([1, 2, 3], 12).every((v) => v === 1)).toBe(true);
  });

  it("captura o pico de dezembro", () => {
    const year = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 300];
    const idx = seasonalIndices([...year, ...year], 12);
    expect(idx[11]).toBeGreaterThan(idx[0]! * 2.5);
  });
});

describe("forecast", () => {
  it("série constante prevê a mesma constante", () => {
    const f = forecast([500, 500, 500, 500, 500, 500], { horizon: 3, period: 0 });
    f.forEach((p) => expect(p.value).toBeCloseTo(500));
  });

  it("tendência clara continua subindo", () => {
    const f = forecast([100, 110, 120, 130, 140, 150], { horizon: 2, period: 0 });
    expect(f[0]!.value).toBeGreaterThan(150);
    expect(f[1]!.value).toBeGreaterThan(f[0]!.value);
  });

  it("banda se abre com o horizonte", () => {
    const f = forecast([90, 110, 95, 105, 100, 98], { horizon: 6, period: 0 });
    const width = (i: number) => f[i]!.high - f[i]!.low;
    expect(width(5)).toBeGreaterThan(width(0));
  });

  it("nunca prevê negativo por padrão", () => {
    const f = forecast([50, 40, 30, 20, 10, 0], { horizon: 6, period: 0 });
    f.forEach((p) => expect(p.low).toBeGreaterThanOrEqual(0));
  });

  it("reaplica a sazonalidade", () => {
    const year = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 300];
    const f = forecast([...year, ...year], { horizon: 12 });
    expect(f[11]!.value).toBeGreaterThan(f[0]!.value * 2);
  });
});

describe("projectBalance", () => {
  it("acumula receita − despesa", () => {
    const inc = [1, 2].map((step) => ({ step, value: 1000, low: 900, high: 1100 }));
    const exp = [1, 2].map((step) => ({ step, value: 600, low: 500, high: 700 }));
    const p = projectBalance(0, inc, exp);
    expect(p[1]!.balance).toBe(800);
  });

  it("banda do acumulado soma variâncias, não larguras", () => {
    // meia-largura mensal 100 (passo 1) e 100/√2 (passo 2), em receita e despesa
    const inc = [1, 2].map((step) => ({ step, value: 1000, low: 900, high: 1100 }));
    const exp = [1, 2].map((step) => ({ step, value: 600, low: 500, high: 700 }));
    const p = projectBalance(0, inc, exp);
    expect(p[0]!.high - p[0]!.balance).toBeCloseTo(Math.sqrt(2 * 100 ** 2));
    expect(p[1]!.high - p[1]!.balance).toBeCloseTo(Math.sqrt(2 * 100 ** 2 + 2 * 5000));
    expect(p[1]!.balance - p[1]!.low).toBeLessThan(400); // a soma ingênua daria 400
  });
});

describe("detectAnomalies", () => {
  it("encontra o gasto fora da curva", () => {
    const a = detectAnomalies([100, 102, 98, 101, 99, 500]);
    expect(a.map((x) => x.index)).toEqual([5]);
  });

  it("série estável não tem anomalias", () => {
    expect(detectAnomalies([100, 100, 100, 100, 100])).toEqual([]);
  });
});

describe("juros compostos", () => {
  it("valor futuro sem aportes", () => {
    expect(futureValue(1000, 0, 0.01, 12)).toBeCloseTo(1126.825, 2);
  });

  it("valor futuro com taxa zero é linear", () => {
    expect(futureValue(1000, 100, 0, 10)).toBe(2000);
  });

  it("taxa anual → mensal equivalente", () => {
    expect((1 + annualToMonthlyRate(0.12)) ** 12).toBeCloseTo(1.12, 10);
  });

  it("meses até a meta", () => {
    expect(monthsToGoal(0, 1000, 100, 0)).toBe(10);
    expect(monthsToGoal(0, 1000, 0, 0)).toBe(Infinity);
  });
});

describe("detectAnomalies com MAD zero", () => {
  it("pega pico em série quase constante", () => {
    const a = detectAnomalies([400, 400, 400, 400, 400, 4400]);
    expect(a.map((x) => x.index)).toEqual([5]);
  });
});
