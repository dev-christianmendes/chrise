import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  BUSINESS_REVENUE_CATEGORIES,
  learnFromHistory,
  parseAmount,
  suggestCategory,
  type TransactionKind,
} from "@chrise/core";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { CategoryBadge } from "@/components/kit";
import { useAccounts, useCategories, useCreateTransaction, useTransactions } from "@/hooks/use-finance";
import { todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";

const shiftDay = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return todayISO(d);
};

export function TransactionForm({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data: categories = [] } = useCategories();
  const { data: accounts = [] } = useAccounts();
  const { data: transactions = [] } = useTransactions();
  const create = useCreateTransaction();
  const amountRef = useRef<HTMLInputElement>(null);

  const [kind, setKind] = useState<TransactionKind>("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [picked, setPicked] = useState(false); // usuário escolheu a categoria à mão
  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState(todayISO);
  const [monthly, setMonthly] = useState(false);

  const today = todayISO();
  const options = categories.filter((c) => c.kind === kind);
  const cents = parseAmount(amount);
  const account = accountId || accounts[0]?.id;
  const valid = cents !== null && cents > 0 && !!categoryId && !!account;

  // Sugestão de categoria pela descrição (histórico + regras), só enquanto o usuário não escolheu.
  const learned = useMemo(() => learnFromHistory(transactions), [transactions]);
  const suggestion = useMemo(() => {
    if (!description.trim() || categories.length === 0) return null;
    const s = suggestCategory(description, kind, { categories, learned });
    return s.source === "fallback" ? null : s;
  }, [description, kind, categories, learned]);

  useEffect(() => {
    if (!picked && suggestion) setCategoryId(suggestion.categoryId);
  }, [suggestion, picked]);

  const reset = () => {
    setAmount("");
    setDescription("");
    setCategoryId("");
    setPicked(false);
    setMonthly(false);
    setDate(todayISO());
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    const category = categories.find((c) => c.id === categoryId);
    await create.mutateAsync({
      kind,
      amount: Math.abs(cents),
      description: description.trim() || category?.name || "",
      categoryId,
      accountId: account,
      date,
      status: date <= today ? "paid" : "pending",
      recurrence: monthly ? "monthly" : "none",
      isBusinessRevenue: kind === "income" && BUSINESS_REVENUE_CATEGORIES.includes(categoryId),
    });
    toast.success(kind === "income" ? "Entrada registrada" : "Gasto registrado");
    reset();
    onOpenChange(false);
  };

  const dateChips = [
    { label: "Hoje", value: today },
    { label: "Ontem", value: shiftDay(today, -1) },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="gap-5 sm:max-w-md"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          amountRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Novo lançamento</DialogTitle>
          <DialogDescription className="sr-only">Valor, categoria e data do lançamento.</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5">
          {/* Tipo */}
          <div role="radiogroup" aria-label="Tipo" className="grid grid-cols-2 rounded-full bg-muted p-1">
            {(["expense", "income"] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => {
                  setKind(k);
                  setCategoryId("");
                  setPicked(false);
                }}
                className={cn(
                  "h-10 rounded-full text-sm font-semibold transition-colors",
                  kind === k ? (k === "income" ? "bg-lime text-[hsl(80_45%_8%)]" : "bg-card text-foreground shadow-sm") : "text-muted-foreground",
                )}
              >
                {k === "expense" ? "Gasto" : "Entrada"}
              </button>
            ))}
          </div>

          {/* Valor: o protagonista */}
          <label className="block text-center">
            <span className="sr-only">Valor em reais</span>
            <span className="flex items-baseline justify-center gap-2">
              <span className="font-display text-2xl text-muted-foreground">R$</span>
              <input
                ref={amountRef}
                inputMode="decimal"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
                // A largura acompanha o que foi digitado: "R$" fica colado no número.
                style={{ width: `${Math.max(4, amount.length + 0.5)}ch` }}
                className={cn(
                  "money max-w-[80%] bg-transparent text-left text-5xl font-semibold outline-none placeholder:text-muted-foreground/40",
                  kind === "income" && "text-income",
                )}
              />
            </span>
          </label>

          <input
            aria-label="Descrição"
            placeholder="Descrição (ex.: iFood, aluguel…)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="h-11 w-full rounded-full border border-input bg-background/60 px-4 text-[0.95rem] outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />

          {/* Categorias em grade de ícones: um toque */}
          <fieldset>
            <legend className="mb-2 flex w-full items-center justify-between text-sm font-medium">
              Categoria
              {suggestion && !picked && (
                <span className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">
                  <Sparkles className="h-3 w-3 text-income" /> sugerida {suggestion.source === "history" ? "pelo seu histórico" : "pela descrição"}
                </span>
              )}
            </legend>
            <div className="grid max-h-[13.5rem] grid-cols-4 gap-2 overflow-y-auto p-0.5 pb-6 [mask-image:linear-gradient(to_bottom,black_80%,transparent)]">
              {options.map((c) => {
                const active = categoryId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setCategoryId(c.id);
                      setPicked(true);
                    }}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-2xl border px-1 py-2.5 text-center transition-colors",
                      active ? "border-foreground bg-muted" : "border-transparent hover:bg-muted/60",
                    )}
                  >
                    <CategoryBadge category={c} size="sm" />
                    <span className="line-clamp-2 text-[11px] font-medium leading-tight">{c.name}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Data e conta */}
          <div className="flex flex-wrap items-center gap-2">
            {dateChips.map((d) => (
              <button
                key={d.label}
                type="button"
                aria-pressed={date === d.value}
                onClick={() => setDate(d.value)}
                className={cn(
                  "h-9 rounded-full border px-3.5 text-sm font-medium",
                  date === d.value ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground",
                )}
              >
                {d.label}
              </button>
            ))}
            <input
              type="date"
              aria-label="Outra data"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className={cn(
                "h-9 rounded-full border bg-transparent px-3 text-sm",
                !dateChips.some((d) => d.value === date) ? "border-foreground" : "border-border text-muted-foreground",
              )}
            />
            {accounts.length > 1 && (
              <select
                aria-label="Conta"
                value={account}
                onChange={(e) => setAccountId(e.target.value)}
                className="h-9 rounded-full border border-border bg-transparent px-3 text-sm text-muted-foreground"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <label className="flex items-center justify-between rounded-2xl border border-border px-4 py-3">
            <span className="text-sm">Repete todo mês</span>
            <Switch checked={monthly} onCheckedChange={setMonthly} />
          </label>

          <Button type="submit" size="lg" className="w-full" disabled={!valid || create.isPending}>
            {create.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
