import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Search, Trash2 } from "lucide-react";
import { formatBRL, monthLabel, toYearMonth } from "@chrise/core";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/Layout";
import { TransactionForm } from "@/components/TransactionForm";
import { ErrorState, PageSkeleton } from "@/components/states";
import { useCategories, useDeleteTransaction, useTransactions } from "@/hooks/use-finance";

export default function Transactions() {
  const [params, setParams] = useSearchParams();
  const { data: transactions, isLoading, error } = useTransactions();
  const { data: categories = [] } = useCategories();
  const remove = useDeleteTransaction();

  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("all");
  const [category, setCategory] = useState("all");
  const formOpen = params.get("new") === "1";
  const setFormOpen = (open: boolean) => setParams(open ? { new: "1" } : {}, { replace: true });

  const categoryName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = (transactions ?? []).filter(
      (t) =>
        (kind === "all" || t.kind === kind) &&
        (category === "all" || t.categoryId === category) &&
        (!q || t.description.toLowerCase().includes(q) || categoryName.get(t.categoryId)?.toLowerCase().includes(q)),
    );
    const byMonth = new Map<string, typeof filtered>();
    for (const t of filtered) {
      const m = toYearMonth(t.date);
      byMonth.set(m, [...(byMonth.get(m) ?? []), t]);
    }
    return [...byMonth.entries()].slice(0, 6);
  }, [transactions, search, kind, category, categoryName]);

  return (
    <div>
      <PageHeader
        title="Lançamentos"
        action={
          <Button onClick={() => setFormOpen(true)} className="gap-2 hidden md:inline-flex">
            <Plus className="w-4 h-4" /> Novo
          </Button>
        }
      />

      <Card className="p-3 mb-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="grid grid-cols-2 gap-3 md:flex">
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger className="md:w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="income">Receitas</SelectItem>
                <SelectItem value="expense">Despesas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="md:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {error ? (
        <ErrorState error={error} />
      ) : isLoading ? (
        <PageSkeleton />
      ) : groups.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">Nenhum lançamento encontrado.</p>
      ) : (
        <div className="space-y-6">
          {groups.map(([month, txs]) => (
            <section key={month}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{monthLabel(month)}</h2>
              <Card className="divide-y divide-border">
                {txs.map((t) => (
                  <div key={t.id} className="group flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{t.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {categoryName.get(t.categoryId)} · {new Date(`${t.date}T12:00:00`).toLocaleDateString("pt-BR")}
                        {t.status === "pending" && <span className="ml-2 rounded bg-warning/10 px-1.5 text-warning">pendente</span>}
                        {t.recurrence === "monthly" && <span className="ml-2 rounded bg-muted px-1.5">mensal</span>}
                      </p>
                    </div>
                    <span className={`text-sm font-semibold tabular-nums ${t.kind === "income" ? "text-success" : "text-danger"}`}>
                      {t.kind === "income" ? "+" : "−"}
                      {formatBRL(t.amount)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Excluir ${t.description}`}
                      className="md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 text-muted-foreground"
                      onClick={() => remove.mutate(t.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </Card>
            </section>
          ))}
          <p className="text-center text-xs text-muted-foreground">Mostrando os 6 meses mais recentes do filtro.</p>
        </div>
      )}

      {/* FAB (mobile) */}
      <Button
        onClick={() => setFormOpen(true)}
        size="icon"
        aria-label="Novo lançamento"
        className="md:hidden fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 h-14 w-14 rounded-full shadow-lg"
      >
        <Plus className="w-6 h-6" />
      </Button>

      <TransactionForm open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
