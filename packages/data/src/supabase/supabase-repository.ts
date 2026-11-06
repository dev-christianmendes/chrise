import type { SupabaseClient } from "@supabase/supabase-js";
import type { Account, Budget, Category, TaxProfile, Transaction } from "@chrise/core";
import type { FinanceRepository, NewBudget, NewTransaction, TransactionFilter } from "../repository";

/**
 * Repositório de produção. O isolamento entre usuários é garantido pelo RLS
 * no banco (ver supabase/migrations); aqui só mapeamos snake_case ↔ camelCase.
 */

type Row = Record<string, unknown>;

const toTransaction = (r: Row): Transaction => ({
  id: r.id as string,
  accountId: r.account_id as string,
  categoryId: r.category_id as string,
  kind: r.kind as Transaction["kind"],
  amount: Number(r.amount_cents),
  description: r.description as string,
  date: r.date as string,
  status: r.status as Transaction["status"],
  recurrence: r.recurrence as Transaction["recurrence"],
  isBusinessRevenue: Boolean(r.is_business_revenue),
  tags: (r.tags as string[] | null) ?? undefined,
});

const fromTransaction = (t: Partial<NewTransaction>): Row => {
  const row: Row = {
    account_id: t.accountId,
    category_id: t.categoryId,
    kind: t.kind,
    amount_cents: t.amount,
    description: t.description,
    date: t.date,
    status: t.status,
    recurrence: t.recurrence,
    is_business_revenue: t.isBusinessRevenue,
    tags: t.tags,
  };
  // Remove chaves undefined para PATCH parcial não sobrescrever com null.
  return Object.fromEntries(Object.entries(row).filter(([, v]) => v !== undefined));
};

const toBudget = (r: Row): Budget => ({
  id: r.id as string,
  categoryId: r.category_id as string,
  month: r.month as string,
  limit: Number(r.limit_cents),
});

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

export class SupabaseRepository implements FinanceRepository {
  readonly source = "supabase" as const;

  constructor(private readonly db: SupabaseClient) {}

  async listCategories(): Promise<Category[]> {
    const rows = unwrap<Row[]>(await this.db.from("categories").select("*").order("name"));
    return rows.map((r) => ({
      id: r.slug as string,
      name: r.name as string,
      group: r.group_name as Category["group"],
      kind: r.kind as Category["kind"],
      nature: r.nature as Category["nature"],
      color: r.color as string,
      icon: (r.icon as string | null) ?? undefined,
    }));
  }

  async listAccounts(): Promise<Account[]> {
    const rows = unwrap<Row[]>(await this.db.from("accounts").select("*").order("name"));
    return rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      type: r.type as Account["type"],
      openingBalance: Number(r.opening_balance_cents),
    }));
  }

  async listTransactions({ from, to }: TransactionFilter = {}) {
    let q = this.db.from("transactions").select("*").order("date", { ascending: false });
    if (from) q = q.gte("date", from);
    if (to) q = q.lte("date", to);
    return unwrap<Row[]>(await q).map(toTransaction);
  }

  async createTransaction(input: NewTransaction) {
    const row = unwrap<Row>(await this.db.from("transactions").insert(fromTransaction(input)).select().single());
    return toTransaction(row);
  }

  async createTransactions(inputs: NewTransaction[]) {
    if (inputs.length === 0) return [];
    // Um único INSERT: o Postgres grava tudo ou nada.
    const rows = unwrap<Row[]>(await this.db.from("transactions").insert(inputs.map(fromTransaction)).select());
    return rows.map(toTransaction);
  }

  async updateTransaction(id: string, patch: Partial<NewTransaction>) {
    const row = unwrap<Row>(
      await this.db.from("transactions").update(fromTransaction(patch)).eq("id", id).select().single(),
    );
    return toTransaction(row);
  }

  async deleteTransaction(id: string) {
    unwrap(await this.db.from("transactions").delete().eq("id", id));
  }

  async listBudgets(month?: string) {
    let q = this.db.from("budgets").select("*");
    if (month) q = q.eq("month", month);
    return unwrap<Row[]>(await q).map(toBudget);
  }

  async upsertBudget(input: NewBudget) {
    const row = unwrap<Row>(
      await this.db
        .from("budgets")
        .upsert(
          { category_id: input.categoryId, month: input.month, limit_cents: input.limit },
          { onConflict: "user_id,category_id,month" },
        )
        .select()
        .single(),
    );
    return toBudget(row);
  }

  async getTaxProfile(): Promise<TaxProfile> {
    const row = unwrap<Row>(await this.db.from("tax_profiles").select("*").single());
    return {
      regime: "simples",
      activity: "ti_fator_r",
      proLabore: Number(row.pro_labore_cents),
      extraReserveRate: Number(row.extra_reserve_rate),
    };
  }

  async saveTaxProfile(profile: TaxProfile) {
    unwrap(
      await this.db
        .from("tax_profiles")
        .upsert(
          { pro_labore_cents: profile.proLabore, extra_reserve_rate: profile.extraReserveRate },
          { onConflict: "user_id" },
        ),
    );
    return profile;
  }
}
