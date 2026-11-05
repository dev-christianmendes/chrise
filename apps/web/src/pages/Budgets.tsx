import { useMemo, useState } from "react";
import { AlertCircle, Pencil } from "lucide-react";
import { budgetStatus, currentYearMonth, formatBRL, formatPercent, monthLabel, toCents } from "@chrise/core";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/Layout";
import { ErrorState, PageSkeleton } from "@/components/states";
import { useBudgets, useCategories, useTransactions, useUpsertBudget } from "@/hooks/use-finance";
import { cn } from "@/lib/utils";

const barColor = { ok: "[&>div]:bg-success", warning: "[&>div]:bg-warning", over: "[&>div]:bg-danger" };

export default function Budgets() {
  const month = currentYearMonth();
  const { data: budgets, isLoading, error } = useBudgets();
  const { data: transactions = [] } = useTransactions();
  const { data: categories = [] } = useCategories();
  const upsert = useUpsertBudget();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newLimit, setNewLimit] = useState("");

  const statuses = useMemo(
    () => (budgets ?? []).filter((b) => b.month === month).map((b) => budgetStatus(b, transactions)).sort((a, b) => b.ratio - a.ratio),
    [budgets, transactions, month],
  );
  const name = new Map(categories.map((c) => [c.id, c.name]));
  const available = categories.filter((c) => c.kind === "expense" && !statuses.some((s) => s.budget.categoryId === c.id));

  const saveLimit = async (categoryId: string, value: string) => {
    const reais = Number(value.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(reais) || reais < 0) return;
    await upsert.mutateAsync({ categoryId, month, limit: toCents(reais) });
    setEditing(null);
  };

  if (error) return <ErrorState error={error} />;
  if (isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader title="Orçamentos" subtitle={`Limites de ${monthLabel(month)}. Alerta em 80% e em 100%.`} />

      <div className="grid gap-3 md:grid-cols-2">
        {statuses.map(({ budget, spent, ratio, level, remaining }) => (
          <Card key={budget.id} className="p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <p className="font-medium">{name.get(budget.categoryId)}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {formatBRL(spent)} de {formatBRL(budget.limit)} · {formatPercent(ratio, 0)}
                </p>
              </div>
              <Button variant="ghost" size="icon" aria-label="Editar limite" onClick={() => { setEditing(budget.categoryId); setDraft(String(budget.limit / 100)); }}>
                <Pencil className="w-4 h-4" />
              </Button>
            </div>
            <Progress value={Math.min(100, ratio * 100)} className={cn("h-2", barColor[level])} />
            {editing === budget.categoryId ? (
              <form className="flex gap-2 mt-3" onSubmit={(e) => { e.preventDefault(); saveLimit(budget.categoryId, draft); }}>
                <Input autoFocus inputMode="decimal" value={draft} onChange={(e) => setDraft(e.target.value)} />
                <Button type="submit" disabled={upsert.isPending}>Salvar</Button>
              </form>
            ) : (
              <p className={cn("mt-2 text-xs flex items-center gap-1", level === "over" ? "text-danger" : "text-muted-foreground")}>
                {level === "over" && <AlertCircle className="w-3 h-3" />}
                {remaining >= 0 ? `Restam ${formatBRL(remaining)}` : `Excedeu ${formatBRL(-remaining)}`}
              </p>
            )}
          </Card>
        ))}
      </div>

      {available.length > 0 && (
        <Card className="p-4">
          <p className="text-sm font-medium mb-3">Novo orçamento</p>
          <form className="flex flex-col sm:flex-row gap-2" onSubmit={(e) => { e.preventDefault(); if (newCategory) saveLimit(newCategory, newLimit).then(() => { setNewCategory(""); setNewLimit(""); }); }}>
            <Select value={newCategory} onValueChange={setNewCategory}>
              <SelectTrigger className="sm:w-56"><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                {available.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="Limite (R$)" inputMode="decimal" value={newLimit} onChange={(e) => setNewLimit(e.target.value)} />
            <Button type="submit" disabled={!newCategory || upsert.isPending}>Adicionar</Button>
          </form>
        </Card>
      )}
    </div>
  );
}
