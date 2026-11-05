/**
 * Tipos de domínio do Chrise.
 *
 * Convenções:
 * - Todo valor monetário é um inteiro em CENTAVOS (`Cents`). Nada de float para dinheiro.
 * - Datas são strings ISO `YYYY-MM-DD` (sem fuso), meses são `YYYY-MM`.
 * - `amount` é sempre positivo; o sinal vem de `kind`.
 */

export type Cents = number;
export type ISODate = string; // YYYY-MM-DD
export type YearMonth = string; // YYYY-MM

export type TransactionKind = "income" | "expense";

/** Natureza do gasto, usada nas métricas de custo fixo x variável. */
export type CostNature = "fixed" | "variable";

export type CategoryGroup =
  | "receita"
  | "moradia"
  | "alimentacao"
  | "pets"
  | "transporte"
  | "saude"
  | "lazer"
  | "assinaturas"
  | "educacao"
  | "impostos"
  | "outros";

export interface Category {
  id: string;
  name: string;
  group: CategoryGroup;
  kind: TransactionKind;
  nature: CostNature;
  color: string; // token CSS, ex.: "hsl(var(--chart-1))"
  icon?: string; // nome do ícone lucide
}

export interface Account {
  id: string;
  name: string;
  type: "checking" | "savings" | "credit_card" | "investment" | "cash";
  /** Saldo inicial no momento do cadastro. */
  openingBalance: Cents;
}

export type Recurrence = "none" | "monthly" | "yearly";

export interface Transaction {
  id: string;
  accountId: string;
  categoryId: string;
  kind: TransactionKind;
  amount: Cents;
  description: string;
  date: ISODate;
  status: "paid" | "pending";
  recurrence: Recurrence;
  /** Marca receitas que são faturamento da PJ (entram no RBT12 do Simples). */
  isBusinessRevenue?: boolean;
  tags?: string[];
}

export interface Budget {
  id: string;
  categoryId: string;
  month: YearMonth;
  limit: Cents;
}

export interface Goal {
  id: string;
  name: string;
  target: Cents;
  saved: Cents;
  deadline?: ISODate;
}

/** Perfil fiscal da PJ, usado pelo módulo de impostos. */
export interface TaxProfile {
  regime: "simples";
  /** Atividade de TI: Anexo V por padrão, Anexo III se Fator R >= 28%. */
  activity: "ti_fator_r";
  /** Pró-labore mensal definido (base para INSS e Fator R). */
  proLabore: Cents;
  /** Percentual extra a reservar além do DAS (ex.: contador, imprevistos), 0–1. */
  extraReserveRate: number;
}
