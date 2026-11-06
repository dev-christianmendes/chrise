import { useMemo, useState } from "react";
import { Check, Pencil, Plus } from "lucide-react";
import { budgetStatus, currentYearMonth, formatBRLCompact, formatPercent, parseAmount } from "@chrise/core";
import { Button } from "@/components/ui/button";
import { CategoryBadge, Money, PageTitle, Ring, SectionTitle } from "@/components/kit";
import { ErrorState, ListSkeleton } from "@/components/states";
import { useBudgets, useCategories, useTransactions, useUpsertBudget } from "@/hooks/use-finance";
import { groupColor } from "@/lib/category-style";
import { monthName } from "@/lib/format";
import { cn } from "@/lib/utils";

const levelColor = { ok: "", warning: "hsl(var(--warning))", over: "hsl(var(--danger))" } as const;

export default function Budgets() {
  const month = currentYearMonth();
  const { data: budgets, isLoading, error } = useBudgets();
  const { data: transactions = [] } = useTransactions();
  const { data: categories = [] } = useCategories();
  const upsert = useUpsertBudget();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState<string | null>(null);

  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const statuses = useMemo(
    () =>
      (budgets ?? [])
        .filter((b) => b.month === month)
        .map((b) => budgetStatus(b, transactions))
        .sort((a, b) => b.ratio - a.ratio),
    [budgets, transactions, month],
  );
  const available = categories.filter((c) => c.kind === "expense" && !statuses.some((s) => s.budget.categoryId === c.id));

  const totalLimit = statuses.reduce((a, s) => a + s.budget.limit, 0);
  const totalSpent = statuses.reduce((a, s) => a + s.spent, 0);
  const over = statuses.filter((s) => s.level === "over").length;

  const saveLimit = async (categoryId: string, value: string) => {
    const cents = parseAmount(value);
    if (cents === null || cents < 0) return;
    await upsert.mutateAsync({ categoryId, month, limit: cents });
    setEditing(null);
    setAdding(null);
    setDraft("");
  };

  if (error) return <ErrorState error={error} />;

  return (
    <div className="mx-auto max-w-4xl">
      <PageTitle eyebrow={`Orçamentos de ${monthName(month)}`} title="Limites" />

      {isLoading ? (
        <ListSkeleton />
      ) : (
        <>
          {statuses.length > 0 && (
            <section className="surface flex items-center gap-5 p-5 animate-rise">
              <Ring value={totalLimit ? totalSpent / totalLimit : 0} size={96} stroke={9} color={over ? "hsl(var(--warning))" : "hsl(var(--income))"}>
                <span className="money text-xl font-semibold">{formatPercent(totalLimit ? totalSpent / totalLimit : 0, 0)}</span>
              </Ring>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Usado dos limites</p>
                <Money value={totalSpent} className="mt-1 block text-2xl font-semibold" />
                <p className="text-sm text-muted-foreground">de {formatBRLCompact(totalLimit)} planejados</p>
                <p className={cn("mt-1 text-sm", over ? "text-danger" : "text-muted-foreground")}>
                  {over ? `${over} ${over === 1 ? "categoria passou" : "categorias passaram"} do limite` : "Tudo dentro do combinado."}
                </p>
              </div>
            </section>
          )}

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {statuses.map(({ budget, spent, ratio, level, remaining }, i) => {
              const category = byId.get(budget.categoryId);
              const color = levelColor[level] || groupColor(category?.group);
              const isEditing = editing === budget.categoryId;
              return (
                <article key={budget.id} className="surface p-4 animate-rise" style={{ animationDelay: `${60 + i * 30}ms` }}>
                  <div className="flex items-center gap-3">
                    <CategoryBadge category={category} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{category?.name ?? budget.categoryId}</p>
                      <p className="text-xs tabular-nums text-muted-foreground">
                        {formatBRLCompact(spent)} de {formatBRLCompact(budget.limit)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Editar limite de ${category?.name}`}
                      onClick={() => {
                        setEditing(isEditing ? null : budget.categoryId);
                        setDraft((budget.limit / 100).toFixed(2).replace(".", ","));
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.min(100, ratio * 100)}%`, background: color }} />
                  </div>

                  {isEditing ? (
                    <form
                      className="mt-3 flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        saveLimit(budget.categoryId, draft);
                      }}
                    >
                      <input
                        autoFocus
                        inputMode="decimal"
                        aria-label="Novo limite"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        className="money h-10 min-w-0 flex-1 rounded-full border border-input bg-background/60 px-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      <Button type="submit" size="icon" aria-label="Salvar limite" disabled={upsert.isPending}>
                        <Check className="h-4 w-4" />
                      </Button>
                    </form>
                  ) : (
                    <p className={cn("mt-2 text-xs font-medium", level === "over" ? "text-danger" : level === "warning" ? "text-warning" : "text-muted-foreground")}>
                      {remaining >= 0 ? `Restam ${formatBRLCompact(remaining)} · ${formatPercent(ratio, 0)} usado` : `Passou ${formatBRLCompact(-remaining)} do limite`}
                    </p>
                  )}
                </article>
              );
            })}
          </div>

          {available.length > 0 && (
            <section className="mt-8">
              <SectionTitle title="Adicionar limite" />
              <div className="rail -mx-4 px-4 md:mx-0 md:flex-wrap md:px-0">
                {available.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setAdding(adding === c.id ? null : c.id);
                      setDraft("");
                    }}
                    aria-pressed={adding === c.id}
                    className={cn(
                      "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border pl-1.5 pr-3.5 text-sm font-medium transition-colors",
                      adding === c.id ? "border-foreground bg-muted" : "border-border bg-card text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <CategoryBadge category={c} size="sm" className="!h-7 !w-7 !rounded-full" />
                    {c.name}
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>
              {adding && (
                <form
                  className="surface mt-3 flex items-center gap-2 p-3 animate-in fade-in slide-in-from-top-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveLimit(adding, draft);
                  }}
                >
                  <span className="pl-2 text-sm text-muted-foreground">Limite para {byId.get(adding)?.name}</span>
                  <input
                    autoFocus
                    inputMode="decimal"
                    placeholder="R$ 0,00"
                    aria-label="Limite"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    className="money h-10 min-w-0 flex-1 rounded-full border border-input bg-background/60 px-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <Button type="submit" disabled={!draft || upsert.isPending}>
                    Criar
                  </Button>
                </form>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
