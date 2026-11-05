/**
 * Previsões estatísticas simples — a "IA básica" do Chrise.
 *
 * Tudo aqui é determinístico e testável. Um LLM pode, no máximo, EXPLICAR
 * esses números; ele nunca os calcula.
 */

export interface Regression {
  slope: number;
  intercept: number;
  /** Coeficiente de determinação (0–1): quanto a reta explica a série. */
  r2: number;
}

/** Regressão linear por mínimos quadrados, com x = 0..n-1. */
export function linearRegression(values: readonly number[]): Regression {
  const n = values.length;
  if (n === 0) return { slope: 0, intercept: 0, r2: 0 };
  if (n === 1) return { slope: 0, intercept: values[0]!, r2: 0 };

  const meanX = (n - 1) / 2;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  values.forEach((y, x) => {
    sxy += (x - meanX) * (y - meanY);
    sxx += (x - meanX) ** 2;
  });
  const slope = sxy / sxx;
  const intercept = meanY - slope * meanX;

  let ssRes = 0;
  let ssTot = 0;
  values.forEach((y, x) => {
    ssRes += (y - (intercept + slope * x)) ** 2;
    ssTot += (y - meanY) ** 2;
  });
  return { slope, intercept, r2: ssTot === 0 ? 1 : 1 - ssRes / ssTot };
}

/** Média móvel ponderada: pesos 1..window, mais peso para os meses recentes. */
export function weightedMovingAverage(values: readonly number[], window = 3): number {
  const tail = values.slice(-window);
  if (tail.length === 0) return 0;
  let num = 0;
  let den = 0;
  tail.forEach((v, i) => {
    num += v * (i + 1);
    den += i + 1;
  });
  return num / den;
}

/**
 * Índices sazonais multiplicativos por posição no ciclo (12 = mensal/anual).
 * Só faz sentido com pelo menos 2 ciclos completos; abaixo disso retorna tudo 1.
 */
export function seasonalIndices(values: readonly number[], period = 12): number[] {
  const ones = Array.from({ length: period }, () => 1);
  if (values.length < period * 2) return ones;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return ones;
  const buckets: number[][] = Array.from({ length: period }, () => []);
  values.forEach((v, i) => buckets[i % period]!.push(v / mean));
  return buckets.map((b) => (b.length ? b.reduce((a, c) => a + c, 0) / b.length : 1));
}

export interface ForecastPoint {
  /** Índice relativo ao fim do histórico: 1 = próximo mês. */
  step: number;
  value: number;
  low: number;
  high: number;
}

export interface ForecastOptions {
  horizon: number;
  /** Período sazonal; use 0 para desligar a sazonalidade. */
  period?: number;
  /** z da banda de confiança. 1.28 ≈ 80%. */
  z?: number;
  /** Impede valores negativos (gastos e receitas não ficam abaixo de zero). */
  nonNegative?: boolean;
}

/**
 * Previsão híbrida:
 * 1. remove sazonalidade (se houver 2+ ciclos);
 * 2. nível = média móvel ponderada recente; tendência = inclinação da regressão,
 *    amortecida pelo R² (tendência fraca → quase plana);
 * 3. reaplica a sazonalidade e abre uma banda que cresce com √passos.
 */
export function forecast(history: readonly number[], options: ForecastOptions): ForecastPoint[] {
  const { horizon, period = 12, z = 1.28, nonNegative = true } = options;
  if (history.length === 0) {
    return Array.from({ length: horizon }, (_, i) => ({ step: i + 1, value: 0, low: 0, high: 0 }));
  }

  const seasonal = period > 0 ? seasonalIndices(history, period) : [];
  const season = (i: number) => (period > 0 ? seasonal[i % period]! : 1);
  const deseason = history.map((v, i) => v / (season(i) || 1));

  const reg = linearRegression(deseason);
  const trend = reg.slope * reg.r2;
  const level = weightedMovingAverage(deseason, Math.min(3, deseason.length));

  const residuals = deseason.map((y, x) => y - (reg.intercept + reg.slope * x));
  const sigma =
    residuals.length > 1
      ? Math.sqrt(residuals.reduce((a, r) => a + r * r, 0) / (residuals.length - 1))
      : Math.abs(level) * 0.1;

  const n = history.length;
  const clamp = (v: number) => (nonNegative ? Math.max(0, v) : v);
  return Array.from({ length: horizon }, (_, i) => {
    const step = i + 1;
    const s = season(n - 1 + step);
    const value = (level + trend * step) * s;
    const spread = z * sigma * Math.sqrt(step) * s;
    return { step, value: clamp(value), low: clamp(value - spread), high: clamp(value + spread) };
  });
}

/** Saldo acumulado projetado mês a mês a partir de previsões de receita e despesa. */
export function projectBalance(
  startBalance: number,
  income: readonly ForecastPoint[],
  expense: readonly ForecastPoint[],
): { step: number; balance: number; low: number; high: number }[] {
  // A banda de cada ponto já cresce com √step (incerteza do NÍVEL naquele mês).
  // Para o saldo ACUMULADO, tratamos o erro de cada mês como independente:
  // variância do acumulado = Σ variâncias mensais. Somar as bandas direto
  // contaria a incerteza duas vezes e explodiria o intervalo.
  const monthlyHalf = (p: ForecastPoint) => (p.high - p.low) / 2 / Math.sqrt(Math.max(1, p.step));
  let mid = startBalance;
  let variance = 0;
  return income.map((inc, i) => {
    const exp = expense[i] ?? { step: inc.step, value: 0, low: 0, high: 0 };
    mid += inc.value - exp.value;
    variance += monthlyHalf(inc) ** 2 + monthlyHalf(exp) ** 2;
    const half = Math.sqrt(variance);
    return { step: inc.step, balance: mid, low: mid - half, high: mid + half };
  });
}

export interface Anomaly {
  index: number;
  value: number;
  score: number;
}

/**
 * Detecção de valores fora do padrão com z-score modificado (mediana/MAD),
 * que é robusto: um gasto gigante não "contamina" a própria régua.
 * Limiar clássico de Iglewicz & Hoaglin: 3,5.
 */
export function detectAnomalies(values: readonly number[], threshold = 3.5): Anomaly[] {
  if (values.length < 4) return [];
  const median = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
  };
  const med = median([...values]);
  const deviations = values.map((v) => Math.abs(v - med));
  const mad = median(deviations);
  // Gastos fixos têm MAD = 0 (quase todo mês igual). Nesse caso usa o desvio
  // absoluto MÉDIO, como recomendam Iglewicz & Hoaglin, para não perder o pico.
  const meanAD = deviations.reduce((a, d) => a + d, 0) / deviations.length;
  const scale = mad > 0 ? mad / 0.6745 : meanAD * 1.253314;
  if (scale === 0) return [];
  return values
    .map((value, index) => ({ index, value, score: (value - med) / scale }))
    .filter((a) => Math.abs(a.score) > threshold);
}

/** Valor futuro com aportes mensais (juros compostos). Taxa mensal em 0–1. */
export function futureValue(present: number, monthlyContribution: number, monthlyRate: number, months: number): number {
  if (monthlyRate === 0) return present + monthlyContribution * months;
  const g = (1 + monthlyRate) ** months;
  return present * g + monthlyContribution * ((g - 1) / monthlyRate);
}

/** Converte taxa anual (ex.: CDI 0,15) em mensal equivalente. */
export const annualToMonthlyRate = (annual: number): number => (1 + annual) ** (1 / 12) - 1;

/** Meses necessários para atingir uma meta com aportes fixos. Infinity se impossível. */
export function monthsToGoal(present: number, target: number, monthlyContribution: number, monthlyRate: number): number {
  if (present >= target) return 0;
  for (let m = 1; m <= 1200; m++) {
    if (futureValue(present, monthlyContribution, monthlyRate, m) >= target) return m;
  }
  return Infinity;
}
