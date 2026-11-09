/**
 * Regras puras do explicador (sem APIs do Deno) para rodarem no Vitest.
 *
 * O contrato abaixo espelha `MonthSummaryInput` de `@chrise/core`. A Edge
 * Function é deliberadamente burra: ela não calcula nada e só pode devolver
 * um texto cujos números existam no payload.
 */
export const EXPLAIN_PROMPT_VERSION = "2026-11-09.v1";

export interface SummaryCategory {
  name: string;
  amount: number;
  share: number;
}

export interface SummaryAttention {
  level: "warning" | "danger";
  title: string;
}

export interface MonthSummaryInput {
  monthLabel: string;
  income: number;
  taxReserve: number;
  committed: number;
  spent: number;
  freeToSpend: number;
  topCategories: SummaryCategory[];
  forecastBalance: number;
  forecastMonths: number;
  attention: SummaryAttention[];
  pendingWrites?: number;
}

const MAX_CENTS = 100_000_000_000;

const isCents = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && Math.abs(value) <= MAX_CENTS;

const isShare = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;

const isText = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.trim().length <= max;

/** Valida e higieniza o payload; qualquer campo fora do contrato derruba a chamada. */
export function parseSummaryInput(value: unknown): MonthSummaryInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;

  const monthLabel = raw.monthLabel;
  const income = raw.income;
  const taxReserve = raw.taxReserve;
  const committed = raw.committed;
  const spent = raw.spent;
  const freeToSpend = raw.freeToSpend;
  const forecastBalance = raw.forecastBalance;
  const forecastMonths = raw.forecastMonths;

  if (!isText(monthLabel, 80)) return null;
  if (!isCents(income) || !isCents(taxReserve) || !isCents(committed) || !isCents(spent) || !isCents(freeToSpend)) return null;
  if (!isCents(forecastBalance)) return null;
  if (!Number.isInteger(forecastMonths) || (forecastMonths as number) < 1 || (forecastMonths as number) > 60) return null;

  if (!Array.isArray(raw.topCategories) || raw.topCategories.length > 6) return null;
  const topCategories: SummaryCategory[] = [];
  for (const item of raw.topCategories) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const category = item as Record<string, unknown>;
    if (!isText(category.name, 80) || !isCents(category.amount) || !isShare(category.share)) return null;
    topCategories.push({ name: category.name.trim(), amount: category.amount, share: category.share });
  }

  if (!Array.isArray(raw.attention) || raw.attention.length > 6) return null;
  const attention: SummaryAttention[] = [];
  for (const item of raw.attention) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const entry = item as Record<string, unknown>;
    if ((entry.level !== "warning" && entry.level !== "danger") || !isText(entry.title, 160)) return null;
    attention.push({ level: entry.level, title: entry.title.trim() });
  }

  let pendingWrites: number | undefined;
  if (raw.pendingWrites !== undefined) {
    if (!Number.isInteger(raw.pendingWrites) || (raw.pendingWrites as number) < 0 || (raw.pendingWrites as number) > 10_000) return null;
    pendingWrites = raw.pendingWrites as number;
  }

  return {
    monthLabel: monthLabel.trim(),
    income,
    taxReserve,
    committed,
    spent,
    freeToSpend,
    topCategories,
    forecastBalance,
    forecastMonths: forecastMonths as number,
    attention,
    pendingWrites,
  };
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const percent = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const formatBRL = (cents: number): string => brl.format(cents / 100);
const formatPercent = (ratio: number): string => percent.format(ratio);

/** Fatos já formatados. A IA recebe só isto: nada de lançamento bruto. */
export function buildPrompt(input: MonthSummaryInput): { system: string; user: string } {
  const facts = {
    mes: input.monthLabel,
    receita: formatBRL(input.income),
    impostoReservado: formatBRL(input.taxReserve),
    custosFixos: formatBRL(input.committed),
    gastoAteAgora: formatBRL(input.spent),
    livreParaGastar: formatBRL(input.freeToSpend),
    maioresGrupos: input.topCategories.map((category) => `${category.name}: ${formatBRL(category.amount)} (${formatPercent(category.share)})`),
    saldoProjetado: `${formatBRL(input.forecastBalance)} em ${input.forecastMonths} meses`,
    pontosDeAtencao: input.attention.map((item) => item.title),
    pendenciasDeSincronizacao: input.pendingWrites ?? 0,
  };

  const system = [
    "Você reescreve um resumo financeiro em português do Brasil, em uma única passada de 3 a 5 frases curtas.",
    "Use somente os fatos fornecidos. Não calcule, não arredonde, não estime e não invente nenhum número.",
    "Se um número não estiver nos fatos, omita-o. Não dê recomendação de investimento.",
    `Versão do prompt: ${EXPLAIN_PROMPT_VERSION}.`,
  ].join(" ");

  const user = `Fatos (JSON):\n${JSON.stringify(facts, null, 2)}\n\nReescreva para o dono do negócio, em tom sóbrio e útil, sem listas.`;

  return { system, user };
}

export function numericTokens(text: string): string[] {
  return text.match(/\d+(?:[.,]\d+)*/g) ?? [];
}

/** Normaliza "1.234,56" e "1234.56" para a mesma chave. */
function normalizeToken(token: string): string {
  return token.replace(/\./g, "").replace(",", ".");
}

function addNumber(allowed: Set<string>, value: number): void {
  if (!Number.isFinite(value)) return;
  const text = String(value);
  allowed.add(text);
  allowed.add(normalizeToken(text));
}

function addCents(allowed: Set<string>, cents: number): void {
  const reais = cents / 100;
  addNumber(allowed, reais);
  allowed.add(reais.toFixed(2));
  for (const token of numericTokens(formatBRL(cents))) allowed.add(normalizeToken(token));
}

function addPercent(allowed: Set<string>, ratio: number): void {
  const value = ratio * 100;
  addNumber(allowed, value);
  allowed.add(value.toFixed(0));
  allowed.add(value.toFixed(1));
  for (const token of numericTokens(formatPercent(ratio))) allowed.add(normalizeToken(token));
}

/** Conjunto de números que o texto reescrito pode conter. */
export function allowedNumberTokens(input: MonthSummaryInput): Set<string> {
  const allowed = new Set<string>();

  addCents(allowed, input.income);
  addCents(allowed, input.taxReserve);
  addCents(allowed, input.committed);
  addCents(allowed, input.spent);
  addCents(allowed, input.freeToSpend);
  addCents(allowed, input.forecastBalance);
  addNumber(allowed, input.forecastMonths);
  if (input.pendingWrites !== undefined) addNumber(allowed, input.pendingWrites);

  for (const category of input.topCategories) {
    addCents(allowed, category.amount);
    addPercent(allowed, category.share);
  }

  for (const text of [input.monthLabel, ...input.topCategories.map((item) => item.name), ...input.attention.map((item) => item.title)]) {
    for (const token of numericTokens(text)) allowed.add(normalizeToken(token));
  }

  return allowed;
}

/**
 * Aceita a resposta só se todo número dela existir no payload. Assim a IA
 * pode reescrever, mas não pode criar um valor financeiro novo.
 */
export function isSafeExplanation(text: string, input: MonthSummaryInput): boolean {
  const clean = text.trim();
  if (clean.length < 40 || clean.length > 1200) return false;
  const allowed = allowedNumberTokens(input);
  return numericTokens(clean).every((token) => allowed.has(normalizeToken(token)));
}
