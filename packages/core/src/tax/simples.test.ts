import { describe, expect, it } from "vitest";
import {
  anexoFor,
  calculateSimples,
  computeRBT12,
  effectiveRate,
  inssOnProLabore,
  minProLaboreForAnexoIII,
} from "./simples";

const R = (reais: number) => Math.round(reais * 100);
const months = (n: number, value: number) => Array.from({ length: n }, () => R(value));

describe("RBT12", () => {
  it("soma os 12 meses anteriores", () => {
    expect(computeRBT12(months(14, 20_000), R(20_000))).toBe(R(240_000));
  });

  it("proporcionaliza no início de atividade", () => {
    expect(computeRBT12(months(3, 10_000), R(10_000))).toBe(R(120_000));
  });

  it("sem histórico usa o próprio mês × 12", () => {
    expect(computeRBT12([], R(15_000))).toBe(R(180_000));
  });
});

describe("alíquota efetiva", () => {
  it("Anexo III, 2ª faixa: (240k × 11,2% − 9.360) / 240k = 7,3%", () => {
    expect(effectiveRate(R(240_000), "III")).toBeCloseTo(0.073, 10);
  });

  it("Anexo V, 2ª faixa: (240k × 18% − 4.500) / 240k = 16,125%", () => {
    expect(effectiveRate(R(240_000), "V")).toBeCloseTo(0.16125, 10);
  });

  it("1ª faixa é a alíquota nominal", () => {
    expect(effectiveRate(R(100_000), "III")).toBeCloseTo(0.06, 10);
    expect(effectiveRate(R(100_000), "V")).toBeCloseTo(0.155, 10);
  });

  it("acima de 4,8 mi lança erro", () => {
    expect(() => effectiveRate(R(5_000_000), "III")).toThrow(RangeError);
  });
});

describe("Fator R", () => {
  it("exatamente 28% já é Anexo III", () => {
    expect(anexoFor(0.28)).toBe("III");
    expect(anexoFor(0.2799)).toBe("V");
  });

  it("pró-labore mínimo para 28% sem erro de arredondamento", () => {
    expect(minProLaboreForAnexoIII(R(240_000))).toBe(R(5_600));
  });

  it("respeita o salário mínimo como piso", () => {
    expect(minProLaboreForAnexoIII(R(30_000))).toBe(R(1_518));
  });
});

describe("INSS sobre pró-labore", () => {
  it("11% do pró-labore", () => {
    expect(inssOnProLabore(R(5_600))).toBe(R(616));
  });

  it("limitado ao teto", () => {
    expect(inssOnProLabore(R(20_000))).toBe(R(897.32));
  });
});

describe("calculateSimples", () => {
  it("dev PJ com 20k/mês e pró-labore no Fator R cai no Anexo III", () => {
    const r = calculateSimples({
      monthRevenue: R(20_000),
      previousRevenues: months(12, 20_000),
      proLabore: R(5_600),
    });
    expect(r.anexo).toBe("III");
    expect(r.das).toBe(R(1_460));
    expect(r.dasOtherAnexo).toBe(R(3_225));
    expect(r.inss).toBe(R(616));
    expect(r.totalReserve).toBe(R(2_076));
    expect(r.netAfterTaxes).toBe(R(17_924));
  });

  it("pró-labore baixo cai no Anexo V e paga bem mais", () => {
    const r = calculateSimples({
      monthRevenue: R(20_000),
      previousRevenues: months(12, 20_000),
      proLabore: R(1_518),
    });
    expect(r.anexo).toBe("V");
    expect(r.das).toBe(R(3_225));
    expect(r.minProLaboreForAnexoIII).toBe(R(5_600));
  });

  it("reserva extra entra no total", () => {
    const r = calculateSimples({
      monthRevenue: R(10_000),
      previousRevenues: [],
      proLabore: R(3_000),
      extraReserveRate: 0.05,
    });
    expect(r.extraReserve).toBe(R(500));
    expect(r.totalReserve).toBe(r.das + r.inss + R(500));
  });
});
