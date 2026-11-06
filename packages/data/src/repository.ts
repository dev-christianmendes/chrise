import type { Account, Budget, Category, ISODate, TaxProfile, Transaction, YearMonth } from "@chrise/core";

export interface TransactionFilter {
  from?: ISODate;
  to?: ISODate;
}

export type NewTransaction = Omit<Transaction, "id">;
export type NewBudget = Omit<Budget, "id">;

/**
 * Contrato único de acesso a dados. A UI só conhece esta interface;
 * mock (demo pública) e Supabase (produção) são detalhes de implementação.
 */
export interface FinanceRepository {
  readonly source: "mock" | "supabase";

  listCategories(): Promise<Category[]>;
  listAccounts(): Promise<Account[]>;

  listTransactions(filter?: TransactionFilter): Promise<Transaction[]>;
  createTransaction(input: NewTransaction): Promise<Transaction>;
  /** Inserção em lote (importação de extrato): tudo ou nada. */
  createTransactions(inputs: NewTransaction[]): Promise<Transaction[]>;
  updateTransaction(id: string, patch: Partial<NewTransaction>): Promise<Transaction>;
  deleteTransaction(id: string): Promise<void>;

  listBudgets(month?: YearMonth): Promise<Budget[]>;
  upsertBudget(input: NewBudget): Promise<Budget>;

  getTaxProfile(): Promise<TaxProfile>;
  saveTaxProfile(profile: TaxProfile): Promise<TaxProfile>;
}
