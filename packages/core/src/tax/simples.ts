import { applyRate, sum } from "../money";
import type { Cents } from "../types";

/**
 * Simples Nacional — cálculo do DAS para atividades de TI sujeitas ao Fator R.
 *
 * Fonte: LC 123/2006, Anexos III e V, com redação da LC 155/2016 (vigente desde 2018).
 * As tabelas ficam aqui como DADOS versionados; quando a lei mudar, crie uma nova
 * versão em vez de editar a antiga. Valide os resultados com seu contador.
 */

export type Anexo = "III" | "V";

interface Bracket {
  /** Teto da faixa (RBT12), em centavos. */
  upTo: Cents;
  /** Alíquota nominal (0–1). */
  rate: number;
  /** Parcela a deduzir, em centavos. */
  deduction: Cents;
}

const R = (reais: number): Cents => reais * 100;

export const SIMPLES_TABLES: Record<Anexo, readonly Bracket[]> = {
  III: [
    { upTo: R(180_000), rate: 0.06, deduction: 0 },
    { upTo: R(360_000), rate: 0.112, deduction: R(9_360) },
    { upTo: R(720_000), rate: 0.135, deduction: R(17_640) },
    { upTo: R(1_800_000), rate: 0.16, deduction: R(35_640) },
    { upTo: R(3_600_000), rate: 0.21, deduction: R(125_640) },
    { upTo: R(4_800_000), rate: 0.33, deduction: R(648_000) },
  ],
  V: [
    { upTo: R(180_000), rate: 0.155, deduction: 0 },
    { upTo: R(360_000), rate: 0.18, deduction: R(4_500) },
    { upTo: R(720_000), rate: 0.195, deduction: R(9_900) },
    { upTo: R(1_800_000), rate: 0.205, deduction: R(17_100) },
    { upTo: R(3_600_000), rate: 0.23, deduction: R(62_100) },
    { upTo: R(4_800_000), rate: 0.305, deduction: R(540_000) },
  ],
};

/** Limite do Fator R: folha / receita >= 28% → Anexo III. */
export const FATOR_R_THRESHOLD = 0.28;

/** Parâmetros previdenciários que mudam todo ano. Atualize via portaria interministerial. */
export const INSS_PARAMS = {
  year: 2025,
  /** Contribuinte individual (sócio) sobre pró-labore. */
  rate: 0.11,
  /** Teto do salário de contribuição. */
  ceiling: R(8_157.41),
  /** Salário mínimo, piso usual do pró-labore. */
  minimumWage: R(1_518),
} as const;

/**
 * RBT12: receita bruta dos 12 meses anteriores ao mês de apuração.
 * No início de atividade (menos de 12 meses), a lei manda usar a média
 * mensal dos meses disponíveis × 12. Sem histórico, usa o próprio mês × 12.
 */
export function computeRBT12(previousRevenues: readonly Cents[], currentRevenue: Cents): Cents {
  const last12 = previousRevenues.slice(-12);
  if (last12.length === 0) return currentRevenue * 12;
  if (last12.length < 12) return Math.round((sum(last12) / last12.length) * 12);
  return sum(last12);
}

export function fatorR(payroll12: Cents, rbt12: Cents): number {
  if (rbt12 <= 0) return 0;
  return payroll12 / rbt12;
}

export function anexoFor(fatorRValue: number): Anexo {
  return fatorRValue >= FATOR_R_THRESHOLD ? "III" : "V";
}

function bracketFor(rbt12: Cents, anexo: Anexo): Bracket {
  const table = SIMPLES_TABLES[anexo];
  const found = table.find((b) => rbt12 <= b.upTo);
  if (!found) {
    throw new RangeError("RBT12 acima de R$ 4,8 milhões: empresa excluída do Simples Nacional.");
  }
  return found;
}

/** Alíquota efetiva = (RBT12 × nominal − dedução) / RBT12. */
export function effectiveRate(rbt12: Cents, anexo: Anexo): number {
  if (rbt12 <= 0) return SIMPLES_TABLES[anexo][0]!.rate;
  const b = bracketFor(rbt12, anexo);
  return (rbt12 * b.rate - b.deduction) / rbt12;
}

export function inssOnProLabore(proLabore: Cents): Cents {
  return applyRate(Math.min(proLabore, INSS_PARAMS.ceiling), INSS_PARAMS.rate);
}

/** Pró-labore mensal mínimo para atingir o Fator R de 28% (arredondado pra cima). */
export function minProLaboreForAnexoIII(rbt12: Cents): Cents {
  // Aritmética inteira (28/1200) para evitar 0.28 * x = ...0000001 virar +1 centavo no ceil.
  const pct = Math.round(FATOR_R_THRESHOLD * 100);
  return Math.max(Math.ceil((rbt12 * pct) / 1200), INSS_PARAMS.minimumWage);
}

export interface SimplesInput {
  /** Faturamento do mês de apuração. */
  monthRevenue: Cents;
  /** Faturamento dos meses anteriores (mais antigo → mais recente). */
  previousRevenues: readonly Cents[];
  /** Pró-labore mensal (assumido constante nos últimos 12 meses). */
  proLabore: Cents;
  /** Reserva extra (0–1) sobre o faturamento: contador, imprevistos. */
  extraReserveRate?: number;
}

export interface SimplesResult {
  rbt12: Cents;
  fatorR: number;
  anexo: Anexo;
  effectiveRate: number;
  das: Cents;
  inss: Cents;
  extraReserve: Cents;
  /** Total a separar do faturamento do mês. */
  totalReserve: Cents;
  /** Quanto efetivamente sobra pra pessoa física. */
  netAfterTaxes: Cents;
  /** Comparativo: DAS se estivesse no outro anexo. */
  dasOtherAnexo: Cents;
  /** Pró-labore mínimo para ficar (ou entrar) no Anexo III. */
  minProLaboreForAnexoIII: Cents;
}

export function calculateSimples(input: SimplesInput): SimplesResult {
  const { monthRevenue, previousRevenues, proLabore, extraReserveRate = 0 } = input;
  const rbt12 = computeRBT12(previousRevenues, monthRevenue);
  const fr = fatorR(proLabore * 12, rbt12);
  const anexo = anexoFor(fr);
  const rate = effectiveRate(rbt12, anexo);
  const das = applyRate(monthRevenue, rate);
  const otherAnexo: Anexo = anexo === "III" ? "V" : "III";
  const dasOtherAnexo = applyRate(monthRevenue, effectiveRate(rbt12, otherAnexo));
  const inss = inssOnProLabore(proLabore);
  const extraReserve = applyRate(monthRevenue, extraReserveRate);
  const totalReserve = das + inss + extraReserve;

  return {
    rbt12,
    fatorR: fr,
    anexo,
    effectiveRate: rate,
    das,
    inss,
    extraReserve,
    totalReserve,
    netAfterTaxes: monthRevenue - totalReserve,
    dasOtherAnexo,
    minProLaboreForAnexoIII: minProLaboreForAnexoIII(rbt12),
  };
}
