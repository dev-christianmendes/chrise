import { describe, expect, it } from "vitest";
import type { NewTransaction } from "../repository";
import { MockRepository } from "./mock-repository";

const repo = () => new MockRepository({ now: new Date("2026-11-09T12:00:00Z"), latency: 0 });

const tx = (patch: Partial<NewTransaction> = {}): NewTransaction => ({
  accountId: "acc-pj",
  categoryId: "mercado",
  kind: "expense",
  amount: 1000,
  description: "Teste",
  date: "2026-11-05",
  status: "paid",
  recurrence: "none",
  isBusinessRevenue: false,
  ...patch,
});

describe("MockRepository", () => {
  it("expõe categorias, contas e um histórico determinístico", async () => {
    const r = repo();
    const [categories, accounts, transactions] = await Promise.all([
      r.listCategories(),
      r.listAccounts(),
      r.listTransactions(),
    ]);

    expect(categories.length).toBeGreaterThan(10);
    expect(accounts).toHaveLength(3);
    expect(transactions.length).toBeGreaterThan(0);
    expect(transactions[0]!.date >= transactions.at(-1)!.date).toBe(true);
  });

  it("filtra o extrato por intervalo de datas", async () => {
    const r = repo();
    const filtered = await r.listTransactions({ from: "2026-10-01", to: "2026-10-31" });

    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((t) => t.date >= "2026-10-01" && t.date <= "2026-10-31")).toBe(true);
  });

  it("cria, atualiza e exclui lançamentos", async () => {
    const r = repo();
    const created = await r.createTransaction(tx());

    expect(created.id).toMatch(/^local-/);
    expect((await r.listTransactions()).some((t) => t.id === created.id)).toBe(true);

    await r.updateTransaction(created.id, { description: "Editado" });
    expect((await r.listTransactions()).find((t) => t.id === created.id)?.description).toBe("Editado");

    await r.deleteTransaction(created.id);
    expect((await r.listTransactions()).some((t) => t.id === created.id)).toBe(false);
  });

  it("rejeita atualizar lançamento inexistente", async () => {
    await expect(repo().updateTransaction("nao-existe", { amount: 1 })).rejects.toThrow(/não encontrada/);
  });

  it("faz upsert de orçamento substituindo o mesmo mês/categoria", async () => {
    const r = repo();
    await r.upsertBudget({ categoryId: "mercado", month: "2026-11", limit: 10000 });
    await r.upsertBudget({ categoryId: "mercado", month: "2026-11", limit: 20000 });

    const budgets = await r.listBudgets("2026-11");
    expect(budgets.filter((b) => b.categoryId === "mercado")).toEqual([
      expect.objectContaining({ month: "2026-11", limit: 20000 }),
    ]);
  });

  it("salva o perfil fiscal e restaura a demo", async () => {
    const r = repo();
    const profile = { regime: "simples" as const, activity: "ti_fator_r" as const, proLabore: 200000, extraReserveRate: 0.05 };

    await r.saveTaxProfile(profile);
    expect(await r.getTaxProfile()).toEqual(profile);

    const created = await r.createTransaction(tx());
    r.reset();
    expect((await r.listTransactions()).some((t) => t.id === created.id)).toBe(false);
  });
});
