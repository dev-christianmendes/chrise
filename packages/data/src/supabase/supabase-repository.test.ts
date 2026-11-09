import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { SupabaseRepository } from "./supabase-repository";

interface Response {
  data: unknown;
  error: { message: string } | null;
}

interface Call {
  table: string;
  op: string;
  payload?: unknown;
}

/** Dublê do query builder do Supabase: registra as chamadas e resolve a resposta da tabela. */
function fakeClient(responses: Record<string, Response> = {}) {
  const calls: Call[] = [];
  const from = (table: string) => {
    const response = responses[table] ?? { data: [], error: null };
    const builder: Record<string, (...args: unknown[]) => unknown> & { then?: unknown } = {};
    for (const op of ["select", "order", "gte", "lte", "eq"]) {
      builder[op] = () => {
        calls.push({ table, op });
        return builder;
      };
    }
    for (const op of ["insert", "update", "upsert"]) {
      builder[op] = (payload: unknown) => {
        calls.push({ table, op, payload });
        return builder;
      };
    }
    builder.delete = () => {
      calls.push({ table, op: "delete" });
      return builder;
    };
    builder.single = () => Promise.resolve(response);
    builder.then = (onFulfilled: (v: Response) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(response).then(onFulfilled, onRejected);
    return builder;
  };
  return { client: { from: vi.fn(from) } as unknown as SupabaseClient, calls };
}

describe("SupabaseRepository", () => {
  it("mapeia categorias, contas e lançamentos de snake_case para o domínio", async () => {
    const { client } = fakeClient({
      categories: {
        data: [{ slug: "mercado", name: "Mercado", group_name: "alimentacao", kind: "expense", nature: "variable", color: "hsl", icon: null }],
        error: null,
      },
      accounts: {
        data: [{ id: "a1", name: "Conta PJ", type: "checking", opening_balance_cents: 400000 }],
        error: null,
      },
      transactions: {
        data: [
          {
            id: "t1",
            account_id: "a1",
            category_id: "mercado",
            kind: "expense",
            amount_cents: 4590,
            description: "Feira",
            date: "2026-11-05",
            status: "paid",
            recurrence: "none",
            is_business_revenue: false,
            tags: ["import:1"],
          },
        ],
        error: null,
      },
    });
    const repo = new SupabaseRepository(client);

    await expect(repo.listCategories()).resolves.toEqual([
      { id: "mercado", name: "Mercado", group: "alimentacao", kind: "expense", nature: "variable", color: "hsl", icon: undefined },
    ]);
    await expect(repo.listAccounts()).resolves.toEqual([
      { id: "a1", name: "Conta PJ", type: "checking", openingBalance: 400000 },
    ]);
    await expect(repo.listTransactions({ from: "2026-11-01", to: "2026-11-30" })).resolves.toEqual([
      {
        id: "t1",
        accountId: "a1",
        categoryId: "mercado",
        kind: "expense",
        amount: 4590,
        description: "Feira",
        date: "2026-11-05",
        status: "paid",
        recurrence: "none",
        isBusinessRevenue: false,
        tags: ["import:1"],
      },
    ]);
  });

  it("grava centavos e remove chaves indefinidas no update parcial", async () => {
    const { client, calls } = fakeClient({
      transactions: {
        data: {
          id: "t1",
          account_id: "a1",
          category_id: "mercado",
          kind: "expense",
          amount_cents: 12050,
          description: "Feira",
          date: "2026-11-05",
          status: "paid",
          recurrence: "none",
          is_business_revenue: false,
        },
        error: null,
      },
    });
    const repo = new SupabaseRepository(client);

    await repo.updateTransaction("t1", { amount: 12050, description: "Feira" });

    expect(calls.find((c) => c.op === "update")).toMatchObject({
      table: "transactions",
      payload: { amount_cents: 12050, description: "Feira" },
    });
    expect((calls.find((c) => c.op === "update")?.payload as Record<string, unknown>).category_id).toBeUndefined();
  });

  it("importa em lote com um único insert", async () => {
    const { client, calls } = fakeClient({ transactions: { data: [], error: null } });
    const repo = new SupabaseRepository(client);

    await repo.createTransactions([
      {
        accountId: "a1",
        categoryId: "mercado",
        kind: "expense",
        amount: 1000,
        description: "A",
        date: "2026-11-05",
        status: "paid",
        recurrence: "none",
        isBusinessRevenue: false,
      },
      {
        accountId: "a1",
        categoryId: "mercado",
        kind: "expense",
        amount: 2000,
        description: "B",
        date: "2026-11-06",
        status: "paid",
        recurrence: "none",
        isBusinessRevenue: false,
      },
    ]);

    const insert = calls.find((c) => c.op === "insert");
    expect(insert?.payload).toHaveLength(2);
    expect(insert?.payload).toEqual(
      expect.arrayContaining([expect.objectContaining({ amount_cents: 1000 }), expect.objectContaining({ amount_cents: 2000 })]),
    );
  });

  it("não chama o banco quando o lote está vazio", async () => {
    const { client, calls } = fakeClient();
    const repo = new SupabaseRepository(client);

    await expect(repo.createTransactions([])).resolves.toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it("faz upsert de orçamento e perfil fiscal", async () => {
    const { client, calls } = fakeClient({
      budgets: { data: { id: "b1", category_id: "mercado", month: "2026-11", limit_cents: 50000 }, error: null },
      tax_profiles: {
        data: { pro_labore_cents: 162100, extra_reserve_rate: 0.03 },
        error: null,
      },
    });
    const repo = new SupabaseRepository(client);

    await expect(repo.upsertBudget({ categoryId: "mercado", month: "2026-11", limit: 50000 })).resolves.toEqual({
      id: "b1",
      categoryId: "mercado",
      month: "2026-11",
      limit: 50000,
    });

    await expect(repo.getTaxProfile()).resolves.toEqual({
      regime: "simples",
      activity: "ti_fator_r",
      proLabore: 162100,
      extraReserveRate: 0.03,
    });

    await repo.saveTaxProfile({ regime: "simples", activity: "ti_fator_r", proLabore: 162100, extraReserveRate: 0.03 });
    expect(calls.some((c) => c.op === "upsert" && c.table === "tax_profiles")).toBe(true);
  });

  it("propaga o erro do Supabase como exceção", async () => {
    const { client } = fakeClient({ categories: { data: null, error: { message: "RLS bloqueou" } } });
    const repo = new SupabaseRepository(client);

    await expect(repo.listCategories()).rejects.toThrow("RLS bloqueou");
  });
});
