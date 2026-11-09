import type { Account, Budget, Category, TaxProfile, Transaction, YearMonth } from "@chrise/core";
import type { FinanceRepository, NewBudget, NewTransaction, TransactionFilter } from "../repository";
import { Outbox, parsePendingId, pendingId, type OutboxOperation } from "./outbox";

export interface Connectivity {
  isOnline(): boolean;
}

export const browserConnectivity: Connectivity = {
  isOnline: () => (typeof navigator === "undefined" ? true : navigator.onLine),
};

const NETWORK_ERROR =
  /failed to fetch|network ?error|networkrequestfailed|load failed|fetch failed|offline|err_internet_disconnected|err_network_changed/i;

/** Erros de rede podem ser enfileirados; erros de regra (RLS, validação) devem subir. */
export function isNetworkError(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return NETWORK_ERROR.test(message);
}

export interface SyncResult {
  synced: number;
  failed: number;
  pending: number;
}

function pendingTransaction(input: NewTransaction, id: string): Transaction {
  return { ...input, id };
}

function matchesFilter(transaction: Transaction, filter?: TransactionFilter): boolean {
  if (!filter) return true;
  if (filter.from && transaction.date < filter.from) return false;
  if (filter.to && transaction.date > filter.to) return false;
  return true;
}

/**
 * Adapter de produção com escrita offline.
 *
 * - Leituras: usa o servidor e guarda o último resultado; sem rede, devolve o
 *   último extrato + lançamentos ainda na fila.
 * - Escritas: tenta o servidor; se a rede falhar, enfileira no IndexedDB e
 *   devolve uma transação otimista com id `pending:`.
 * - `sync()` drena a fila em ordem e para no primeiro erro de rede.
 */
export class OfflineRepository implements FinanceRepository {
  readonly source: "mock" | "supabase";
  private lastKnownTransactions: Transaction[] = [];

  constructor(
    private readonly remote: FinanceRepository,
    private readonly outbox: Outbox = new Outbox(),
    private readonly connectivity: Connectivity = browserConnectivity,
  ) {
    this.source = remote.source;
  }

  listCategories(): Promise<Category[]> {
    return this.remote.listCategories();
  }

  listAccounts(): Promise<Account[]> {
    return this.remote.listAccounts();
  }

  async listTransactions(filter?: TransactionFilter): Promise<Transaction[]> {
    let remoteTransactions: Transaction[] = [];
    try {
      remoteTransactions = await this.remote.listTransactions(filter);
      if (!filter) this.lastKnownTransactions = remoteTransactions;
    } catch (error) {
      if (!isNetworkError(error)) throw error;
      remoteTransactions = filter ? this.lastKnownTransactions.filter((t) => matchesFilter(t, filter)) : this.lastKnownTransactions;
    }

    const pending = await this.pendingTransactions();
    const merged = [...pending, ...remoteTransactions];
    return merged
      .filter((transaction) => matchesFilter(transaction, filter))
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  async createTransaction(input: NewTransaction): Promise<Transaction> {
    if (this.connectivity.isOnline()) {
      try {
        return await this.remote.createTransaction(input);
      } catch (error) {
        if (!isNetworkError(error)) throw error;
      }
    }

    const operation = await this.outbox.enqueue({ type: "create", input });
    return pendingTransaction(input, pendingId(operation.id));
  }

  async createTransactions(inputs: NewTransaction[]): Promise<Transaction[]> {
    if (inputs.length === 0) return [];

    if (this.connectivity.isOnline()) {
      try {
        return await this.remote.createTransactions(inputs);
      } catch (error) {
        if (!isNetworkError(error)) throw error;
      }
    }

    const operation = await this.outbox.enqueue({ type: "createMany", inputs });
    return inputs.map((input, index) => pendingTransaction(input, pendingId(operation.id, index)));
  }

  async updateTransaction(id: string, patch: Partial<NewTransaction>): Promise<Transaction> {
    const pending = parsePendingId(id);
    if (pending) return this.updatePending(id, pending.operationId, pending.index, patch);

    if (!this.connectivity.isOnline()) {
      throw new Error("Editar um lançamento já sincronizado exige conexão.");
    }
    return this.remote.updateTransaction(id, patch);
  }

  async deleteTransaction(id: string): Promise<void> {
    const pending = parsePendingId(id);
    if (pending) {
      await this.removePending(pending.operationId, pending.index);
      return;
    }

    if (this.connectivity.isOnline()) {
      try {
        await this.remote.deleteTransaction(id);
        return;
      } catch (error) {
        if (!isNetworkError(error)) throw error;
      }
    }

    await this.outbox.enqueue({ type: "delete", transactionId: id });
  }

  listBudgets(month?: YearMonth): Promise<Budget[]> {
    return this.remote.listBudgets(month);
  }

  upsertBudget(input: NewBudget): Promise<Budget> {
    return this.remote.upsertBudget(input);
  }

  getTaxProfile(): Promise<TaxProfile> {
    return this.remote.getTaxProfile();
  }

  saveTaxProfile(profile: TaxProfile): Promise<TaxProfile> {
    return this.remote.saveTaxProfile(profile);
  }

  pendingCount(): Promise<number> {
    return this.outbox.size();
  }

  /** Drena a fila. Erros de rede pausam a drenagem; erros de regra descartam a operação. */
  async sync(): Promise<SyncResult> {
    if (!this.connectivity.isOnline()) {
      return { synced: 0, failed: 0, pending: await this.outbox.size() };
    }

    let synced = 0;
    let failed = 0;
    for (const operation of await this.outbox.list()) {
      try {
        await this.flush(operation);
        await this.outbox.remove(operation.id);
        synced += 1;
      } catch (error) {
        if (isNetworkError(error)) break;
        await this.outbox.remove(operation.id);
        failed += 1;
      }
    }

    return { synced, failed, pending: await this.outbox.size() };
  }

  private async flush(operation: OutboxOperation): Promise<void> {
    switch (operation.type) {
      case "create":
        await this.remote.createTransaction(operation.input);
        return;
      case "createMany":
        await this.remote.createTransactions(operation.inputs);
        return;
      case "update":
        await this.remote.updateTransaction(operation.transactionId, operation.patch);
        return;
      case "delete":
        await this.remote.deleteTransaction(operation.transactionId);
        return;
    }
  }

  private async pendingTransactions(): Promise<Transaction[]> {
    const operations = await this.outbox.list();
    return operations.flatMap((operation): Transaction[] => {
      if (operation.type === "create") return [pendingTransaction(operation.input, pendingId(operation.id))];
      if (operation.type === "createMany") {
        return operation.inputs.map((input, index) => pendingTransaction(input, pendingId(operation.id, index)));
      }
      return [];
    });
  }

  private async updatePending(
    id: string,
    operationId: string,
    index: number | undefined,
    patch: Partial<NewTransaction>,
  ): Promise<Transaction> {
    const operation = (await this.outbox.list()).find((item) => item.id === operationId);
    if (!operation) throw new Error("Lançamento pendente não encontrado.");

    if (operation.type === "create") {
      const input = { ...operation.input, ...patch };
      await this.outbox.update({ ...operation, input });
      return pendingTransaction(input, id);
    }

    if (operation.type === "createMany" && index !== undefined) {
      const input = operation.inputs[index];
      if (!input) throw new Error("Lançamento pendente não encontrado.");
      const updated = { ...input, ...patch };
      const inputs = operation.inputs.map((item, i) => (i === index ? updated : item));
      await this.outbox.update({ ...operation, inputs });
      return pendingTransaction(updated, id);
    }

    throw new Error("Lançamento pendente não encontrado.");
  }

  private async removePending(operationId: string, index: number | undefined): Promise<void> {
    const operation = (await this.outbox.list()).find((item) => item.id === operationId);
    if (!operation) return;

    if (operation.type === "create") {
      await this.outbox.remove(operation.id);
      return;
    }

    if (operation.type === "createMany" && index !== undefined) {
      const inputs = operation.inputs.filter((_, i) => i !== index);
      if (inputs.length === 0) await this.outbox.remove(operation.id);
      else await this.outbox.update({ ...operation, inputs });
    }
  }
}
