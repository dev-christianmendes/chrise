import type { Budget, Category, TaxProfile, Transaction } from "@chrise/core";
import { currentYearMonth } from "@chrise/core";
import { DEFAULT_CATEGORIES } from "../categories";
import type { FinanceRepository, NewBudget, NewTransaction, TransactionFilter } from "../repository";
import { generateMockDataset, type MockDataset } from "./generate";

const STORAGE_KEY = "chrise:demo:v1";

interface StoredChanges {
  added: Transaction[];
  updated: Record<string, Partial<Transaction>>;
  deleted: string[];
  budgets: Budget[];
  taxProfile?: TaxProfile;
}

const emptyChanges = (): StoredChanges => ({ added: [], updated: {}, deleted: [], budgets: [] });

/** Armazenamento opcional: no navegador persiste as edições do visitante; em testes/SSR, só memória. */
function loadChanges(): StoredChanges {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    return raw ? { ...emptyChanges(), ...JSON.parse(raw) } : emptyChanges();
  } catch {
    return emptyChanges();
  }
}

function saveChanges(changes: StoredChanges) {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(changes));
  } catch {
    /* modo privado / storage bloqueado: segue só em memória */
  }
}

export interface MockRepositoryOptions {
  now?: Date;
  /** Latência artificial (ms) para a demo exibir os estados de loading. */
  latency?: number;
}

/**
 * Repositório da demo pública: dados gerados + edições do visitante por cima,
 * guardadas no navegador. "Resetar demo" apaga só as edições.
 */
export class MockRepository implements FinanceRepository {
  readonly source = "mock" as const;
  private base: MockDataset;
  private changes: StoredChanges;
  private latency: number;

  constructor({ now = new Date(), latency = 150 }: MockRepositoryOptions = {}) {
    const today = now.toISOString().slice(0, 10);
    this.base = generateMockDataset({ endMonth: currentYearMonth(now), today });
    this.changes = loadChanges();
    this.latency = latency;
  }

  private delay<T>(value: T): Promise<T> {
    if (this.latency <= 0) return Promise.resolve(value);
    return new Promise((resolve) => setTimeout(() => resolve(value), this.latency));
  }

  private commit() {
    saveChanges(this.changes);
  }

  private allTransactions(): Transaction[] {
    const deleted = new Set(this.changes.deleted);
    return [...this.changes.added, ...this.base.transactions]
      .filter((t) => !deleted.has(t.id))
      .map((t) => ({ ...t, ...this.changes.updated[t.id] }))
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }

  reset() {
    this.changes = emptyChanges();
    this.commit();
  }

  listCategories(): Promise<Category[]> {
    return this.delay([...DEFAULT_CATEGORIES]);
  }

  listAccounts() {
    return this.delay([...this.base.accounts]);
  }

  listTransactions(filter: TransactionFilter = {}) {
    const { from, to } = filter;
    return this.delay(
      this.allTransactions().filter((t) => (!from || t.date >= from) && (!to || t.date <= to)),
    );
  }

  createTransaction(input: NewTransaction) {
    const tx: Transaction = { ...input, id: `local-${crypto.randomUUID()}` };
    this.changes.added.push(tx);
    this.commit();
    return this.delay(tx);
  }

  createTransactions(inputs: NewTransaction[]) {
    const txs = inputs.map((input): Transaction => ({ ...input, id: `local-${crypto.randomUUID()}` }));
    this.changes.added.push(...txs);
    this.commit();
    return this.delay(txs);
  }

  updateTransaction(id: string, patch: Partial<NewTransaction>) {
    const current = this.allTransactions().find((t) => t.id === id);
    if (!current) return Promise.reject(new Error(`Transação ${id} não encontrada`));
    this.changes.updated[id] = { ...this.changes.updated[id], ...patch };
    this.commit();
    return this.delay({ ...current, ...patch });
  }

  deleteTransaction(id: string) {
    this.changes.added = this.changes.added.filter((t) => t.id !== id);
    if (!this.changes.deleted.includes(id)) this.changes.deleted.push(id);
    this.commit();
    return this.delay(undefined);
  }

  listBudgets(month?: string) {
    const overrides = new Map(this.changes.budgets.map((b) => [`${b.month}:${b.categoryId}`, b]));
    const merged = this.base.budgets.map((b) => overrides.get(`${b.month}:${b.categoryId}`) ?? b);
    const extra = this.changes.budgets.filter(
      (b) => !this.base.budgets.some((x) => x.month === b.month && x.categoryId === b.categoryId),
    );
    return this.delay([...merged, ...extra].filter((b) => !month || b.month === month));
  }

  upsertBudget(input: NewBudget) {
    const budget: Budget = { ...input, id: `budget-${input.month}-${input.categoryId}` };
    this.changes.budgets = [
      ...this.changes.budgets.filter((b) => !(b.month === input.month && b.categoryId === input.categoryId)),
      budget,
    ];
    this.commit();
    return this.delay(budget);
  }

  getTaxProfile() {
    return this.delay(this.changes.taxProfile ?? this.base.taxProfile);
  }

  saveTaxProfile(profile: TaxProfile) {
    this.changes.taxProfile = profile;
    this.commit();
    return this.delay(profile);
  }
}
