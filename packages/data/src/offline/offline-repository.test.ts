import { describe, expect, it, vi } from "vitest";
import type { Account, Budget, Category, TaxProfile, Transaction, YearMonth } from "@chrise/core";
import type { FinanceRepository, NewBudget, NewTransaction, TransactionFilter } from "../repository";
import { MemoryOutboxStore, Outbox } from "./outbox";
import { OfflineRepository, type Connectivity } from "./offline-repository";

const input = (description: string): NewTransaction => ({
  accountId: "acc-1",
  categoryId: "cat-1",
  kind: "expense",
  amount: 1290,
  description,
  date: "2026-11-09",
  status: "paid",
  recurrence: "none",
});

const transaction = (id: string, description = "Compra"): Transaction => ({ ...input(description), id });

class FakeRemote implements FinanceRepository {
  readonly source = "supabase" as const;
  online = true;
  transactions: Transaction[] = [];
  private sequence = 0;

  private fail(): never {
    throw new TypeError("Failed to fetch");
  }

  listCategories = vi.fn(async (): Promise<Category[]> => []);
  listAccounts = vi.fn(async (): Promise<Account[]> => []);
  listTransactions = vi.fn(async (filter?: TransactionFilter): Promise<Transaction[]> => {
    if (!this.online) this.fail();
    return this.transactions.filter(
      (item) => (!filter?.from || item.date >= filter.from) && (!filter?.to || item.date <= filter.to),
    );
  });
  createTransaction = vi.fn(async (value: NewTransaction): Promise<Transaction> => {
    if (!this.online) this.fail();
    return { ...value, id: `srv-${++this.sequence}` };
  });
  createTransactions = vi.fn(async (values: NewTransaction[]): Promise<Transaction[]> => {
    if (!this.online) this.fail();
    return values.map((value) => ({ ...value, id: `srv-${++this.sequence}` }));
  });
  updateTransaction = vi.fn(async (id: string, patch: Partial<NewTransaction>): Promise<Transaction> => {
    if (!this.online) this.fail();
    const current = this.transactions.find((item) => item.id === id);
    return { ...(current ?? transaction(id)), ...patch };
  });
  deleteTransaction = vi.fn(async (_id: string): Promise<void> => {
    if (!this.online) this.fail();
  });
  listBudgets = vi.fn(async (_month?: YearMonth): Promise<Budget[]> => []);
  upsertBudget = vi.fn(async (value: NewBudget): Promise<Budget> => ({ ...value, id: "budget-1" }));
  getTaxProfile = vi.fn(
    async (): Promise<TaxProfile> => ({ regime: "simples", activity: "ti_fator_r", proLabore: 0, extraReserveRate: 0 }),
  );
  saveTaxProfile = vi.fn(async (profile: TaxProfile): Promise<TaxProfile> => profile);
}

function setup() {
  const remote = new FakeRemote();
  const outbox = new Outbox(new MemoryOutboxStore());
  let online = true;
  const connectivity: Connectivity = { isOnline: () => online };
  const repository = new OfflineRepository(remote, outbox, connectivity);

  return {
    remote,
    outbox,
    repository,
    setOnline: (value: boolean) => {
      online = value;
      remote.online = value;
    },
  };
}

describe("OfflineRepository", () => {
  it("usa o servidor quando online e não enfileira", async () => {
    const { remote, outbox, repository } = setup();

    const created = await repository.createTransaction(input("online"));

    expect(created.id).toBe("srv-1");
    expect(remote.createTransaction).toHaveBeenCalledTimes(1);
    expect(await outbox.size()).toBe(0);
  });

  it("enfileira e devolve transação pendente quando offline", async () => {
    const { remote, outbox, repository, setOnline } = setup();
    setOnline(false);

    const created = await repository.createTransaction(input("offline"));

    expect(created.id).toMatch(/^pending:/);
    expect(remote.createTransaction).not.toHaveBeenCalled();
    expect(await outbox.size()).toBe(1);

    const listed = await repository.listTransactions();
    expect(listed.map((item) => item.id)).toContain(created.id);
  });

  it("enfileira a importação em lote como uma única operação", async () => {
    const { remote, outbox, repository, setOnline } = setup();
    setOnline(false);

    const created = await repository.createTransactions([input("a"), input("b")]);

    expect(created).toHaveLength(2);
    expect(created[0]?.id).toMatch(/:0$/);
    expect(created[1]?.id).toMatch(/:1$/);
    expect(remote.createTransactions).not.toHaveBeenCalled();
    expect(await outbox.size()).toBe(1);
  });

  it("drena a fila quando a rede volta", async () => {
    const { remote, outbox, repository, setOnline } = setup();
    setOnline(false);
    await repository.createTransaction(input("a"));
    await repository.createTransaction(input("b"));
    setOnline(true);

    const result = await repository.sync();

    expect(result).toEqual({ synced: 2, failed: 0, pending: 0 });
    expect(remote.createTransaction).toHaveBeenCalledTimes(2);
    expect(await outbox.size()).toBe(0);
  });

  it("enfileira quando o servidor cai mesmo com navigator.onLine", async () => {
    const { remote, outbox, repository } = setup();
    remote.createTransaction.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const created = await repository.createTransaction(input("rede caiu"));

    expect(created.id).toMatch(/^pending:/);
    expect(await outbox.size()).toBe(1);
  });

  it("propaga erros de regra sem enfileirar", async () => {
    const { remote, outbox, repository } = setup();
    remote.createTransaction.mockRejectedValueOnce(new Error("new row violates row-level security policy"));

    await expect(repository.createTransaction(input("negado"))).rejects.toThrow(/row-level security/);
    expect(await outbox.size()).toBe(0);
  });

  it("pausa a sincronização no primeiro erro de rede", async () => {
    const { remote, outbox, repository, setOnline } = setup();
    setOnline(false);
    await repository.createTransaction(input("a"));
    await repository.createTransaction(input("b"));
    setOnline(true);
    remote.createTransaction.mockRejectedValue(new TypeError("Failed to fetch"));

    const result = await repository.sync();

    expect(result.synced).toBe(0);
    expect(result.pending).toBe(2);
    expect(await outbox.size()).toBe(2);
  });

  it("descarta operações inválidas e segue drenando", async () => {
    const { remote, outbox, repository, setOnline } = setup();
    setOnline(false);
    await repository.createTransaction(input("inválida"));
    await repository.createTransaction(input("válida"));
    setOnline(true);
    remote.createTransaction.mockRejectedValueOnce(new Error("validation failed"));

    const result = await repository.sync();

    expect(result).toEqual({ synced: 1, failed: 1, pending: 0 });
    expect(await outbox.size()).toBe(0);
  });

  it("enfileira delete offline e o executa na sincronização", async () => {
    const { remote, outbox, repository, setOnline } = setup();
    setOnline(false);

    await repository.deleteTransaction("tx-1");
    expect(await outbox.size()).toBe(1);

    setOnline(true);
    await repository.sync();

    expect(remote.deleteTransaction).toHaveBeenCalledWith("tx-1");
    expect(await outbox.size()).toBe(0);
  });

  it("remove um lançamento pendente sem tocar no servidor", async () => {
    const { remote, outbox, repository, setOnline } = setup();
    setOnline(false);
    const created = await repository.createTransaction(input("some"));

    await repository.deleteTransaction(created.id);

    expect(await outbox.size()).toBe(0);
    expect(remote.deleteTransaction).not.toHaveBeenCalled();
  });

  it("remove um item de um lote pendente e mantém o restante", async () => {
    const { repository, setOnline } = setup();
    setOnline(false);
    const created = await repository.createTransactions([input("a"), input("b")]);

    await repository.deleteTransaction(created[0]!.id);

    const listed = await repository.listTransactions();
    expect(listed.map((item) => item.description)).toEqual(["b"]);
  });

  it("edita um lançamento pendente na própria fila", async () => {
    const { remote, repository, setOnline } = setup();
    setOnline(false);
    const created = await repository.createTransaction(input("antes"));

    const updated = await repository.updateTransaction(created.id, { description: "depois" });

    expect(updated.description).toBe("depois");
    expect(remote.updateTransaction).not.toHaveBeenCalled();
    const listed = await repository.listTransactions();
    expect(listed[0]?.description).toBe("depois");
  });

  it("mantém o último extrato em cache quando a leitura cai", async () => {
    const { remote, repository, setOnline } = setup();
    remote.transactions = [transaction("srv-1", "Mercado")];
    expect(await repository.listTransactions()).toHaveLength(1);

    setOnline(false);
    await repository.createTransaction(input("offline"));

    const listed = await repository.listTransactions();
    expect(listed.map((item) => item.description)).toEqual(["offline", "Mercado"]);
  });
});
