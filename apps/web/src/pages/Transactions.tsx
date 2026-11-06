import { useMemo, useState } from "react";
import { CalendarClock, ChevronDown, FileUp, Search, Trash2, X } from "lucide-react";
import { monthLabel, toYearMonth, type CategoryGroup, type Transaction } from "@chrise/core";
import { Button } from "@/components/ui/button";
import { CategoryBadge, Money, PageTitle } from "@/components/kit";
import { ErrorState, ListSkeleton } from "@/components/states";
import { useCategories, useDeleteTransaction, useTransactions } from "@/hooks/use-finance";
import { useSheetParam } from "@/hooks/use-ui";
import { GROUP_LABEL, groupColor } from "@/lib/category-style";
import { monthName, relativeDay, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Kind = "all" | "expense" | "income";
const KINDS: { value: Kind; label: string }[] = [
  { value: "all", label: "Tudo" },
  { value: "expense", label: "Saídas" },
  { value: "income", label: "Entradas" },
];

export default function Transactions() {
  const { data: transactions, isLoading, error } = useTransactions();
  const { data: categories = [] } = useCategories();
  const remove = useDeleteTransaction();
  const [, setImportOpen] = useSheetParam("import");
  const today = todayISO();

  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<Kind>("all");
  const [group, setGroup] = useState<CategoryGroup | null>(null);
  const [months, setMonths] = useState(3);
  const [selected, setSelected] = useState<string | null>(null);
  const [showUpcoming, setShowUpcoming] = useState(false);

  const byCategory = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  /** Grupos que aparecem nos lançamentos, para os filtros rápidos. */
  const groups = useMemo(() => {
    const seen = new Set<CategoryGroup>();
    for (const t of transactions ?? []) {
      const g = byCategory.get(t.categoryId)?.group;
      if (g) seen.add(g);
    }
    return Object.keys(GROUP_LABEL).filter((g) => seen.has(g as CategoryGroup)) as CategoryGroup[];
  }, [transactions, byCategory]);

  const { sections, totalMonths, upcoming } = useMemo(() => {
    const q = search.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const filtered = (transactions ?? []).filter((t) => {
      const c = byCategory.get(t.categoryId);
      return (
        (kind === "all" || t.kind === kind) && (!group || c?.group === group) && (!q || norm(t.description).includes(q) || norm(c?.name ?? "").includes(q))
      );
    });

    // Futuros ficam num card à parte: o extrato começa no que já aconteceu.
    const upcoming = filtered.filter((t) => t.date > today).sort((a, b) => (a.date < b.date ? -1 : 1));

    // mês → dia → lançamentos
    const byMonth = new Map<string, Map<string, Transaction[]>>();
    for (const t of filtered) {
      if (t.date > today) continue;
      const m = toYearMonth(t.date);
      const days = byMonth.get(m) ?? new Map<string, Transaction[]>();
      days.set(t.date, [...(days.get(t.date) ?? []), t]);
      byMonth.set(m, days);
    }
    const all = [...byMonth.entries()].map(([month, days]) => {
      const txs = [...days.values()].flat();
      return {
        month,
        days: [...days.entries()],
        income: txs.filter((t) => t.kind === "income").reduce((a, t) => a + t.amount, 0),
        expense: txs.filter((t) => t.kind === "expense").reduce((a, t) => a + t.amount, 0),
      };
    });
    return { sections: all.slice(0, months), totalMonths: all.length, upcoming };
  }, [transactions, byCategory, search, kind, group, months, today]);

  const renderRow = (t: Transaction) => {
    const c = byCategory.get(t.categoryId);
    const open = selected === t.id;
    return (
      <li key={t.id}>
        <button
          type="button"
          onClick={() => setSelected(open ? null : t.id)}
          aria-expanded={open}
          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
        >
          <CategoryBadge category={c} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[0.95rem] font-medium">{t.description}</span>
            <span className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              {c?.name}
              {t.status === "pending" && <span className="rounded-full bg-warning/15 px-1.5 py-px font-semibold text-warning">a vencer</span>}
              {t.recurrence === "monthly" && <span className="rounded-full bg-muted px-1.5 py-px">mensal</span>}
            </span>
          </span>
          <Money
            value={t.amount}
            sign={t.kind === "income" ? "+" : "−"}
            className={cn("text-[0.95rem] font-semibold", t.kind === "income" && "text-income", t.status === "pending" && "opacity-60")}
          />
        </button>
        {open && (
          <div className="flex items-center justify-between gap-3 bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground animate-in fade-in slide-in-from-top-1">
            <span>
              {new Date(`${t.date}T12:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}
              {t.tags?.some((x) => x.startsWith("import:")) && " · importado"}
            </span>
            <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-danger hover:text-danger" disabled={remove.isPending} onClick={() => del(t)}>
              <Trash2 className="h-4 w-4" /> Excluir
            </Button>
          </div>
        )}
      </li>
    );
  };

  const del = async (t: Transaction) => {
    await remove.mutateAsync(t.id);
    setSelected(null);
    toast.success("Lançamento excluído");
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle
        eyebrow="Seus lançamentos"
        title="Extrato"
        action={
          <Button variant="outline" onClick={() => setImportOpen(true)} className="gap-2">
            <FileUp className="h-4 w-4" /> Importar
          </Button>
        }
      />

      {/* Filtros: busca + tipo + grupos (chips roláveis) */}
      <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-10 -mx-4 space-y-3 bg-background/85 px-4 pb-3 pt-1 backdrop-blur-xl md:top-0 md:mx-0 md:px-0">
        <div className="flex gap-2">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <span className="sr-only">Buscar</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar lançamento"
              className="h-11 w-full rounded-full border border-input bg-card pl-10 pr-9 text-[0.95rem] outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Limpar busca"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </label>
          <div role="radiogroup" aria-label="Tipo" className="hidden h-11 items-center rounded-full bg-muted p-1 sm:flex">
            {KINDS.map((k) => (
              <button
                key={k.value}
                role="radio"
                aria-checked={kind === k.value}
                onClick={() => setKind(k.value)}
                className={cn(
                  "h-9 rounded-full px-3.5 text-sm font-semibold transition-colors",
                  kind === k.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
                )}
              >
                {k.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rail -mx-4 px-4 md:mx-0 md:px-0">
          {KINDS.slice(1).map((k) => (
            <Chip key={k.value} active={kind === k.value} onClick={() => setKind(kind === k.value ? "all" : k.value)} className="sm:hidden">
              {k.label}
            </Chip>
          ))}
          <span aria-hidden className="w-px shrink-0 self-stretch bg-border sm:hidden" />
          {groups.map((g) => (
            <Chip key={g} active={group === g} onClick={() => setGroup(group === g ? null : g)}>
              <span className="h-2 w-2 rounded-full" style={{ background: groupColor(g) }} />
              {GROUP_LABEL[g]}
            </Chip>
          ))}
        </div>
      </div>

      {error ? (
        <ErrorState error={error} />
      ) : isLoading ? (
        <ListSkeleton />
      ) : sections.length === 0 && upcoming.length === 0 ? (
        <div className="surface mt-2 p-10 text-center">
          <p className="font-medium">Nada por aqui.</p>
          <p className="mt-1 text-sm text-muted-foreground">Tente outra busca ou limpe os filtros.</p>
        </div>
      ) : (
        <div className="mt-2 space-y-8">
          {upcoming.length > 0 && (
            <section className="surface overflow-hidden">
              <button
                type="button"
                onClick={() => setShowUpcoming((v) => !v)}
                aria-expanded={showUpcoming}
                className="flex w-full items-center gap-3 p-4 text-left"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[0.85rem] bg-warning/15 text-warning">
                  <CalendarClock className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">A vencer · {upcoming.length}</span>
                  <span className="block text-xs text-muted-foreground">
                    próximo: {upcoming[0]!.description}, {relativeDay(upcoming[0]!.date, today).toLowerCase()}
                  </span>
                </span>
                <Money value={upcoming.reduce((a, t) => a + (t.kind === "income" ? t.amount : -t.amount), 0)} sign="auto" className="text-sm font-semibold" />
                <ChevronDown className={cn("h-5 w-5 shrink-0 text-muted-foreground transition-transform", showUpcoming && "rotate-180")} />
              </button>
              {showUpcoming && <ul className="divide-y divide-border border-t border-border">{upcoming.map(renderRow)}</ul>}
            </section>
          )}

          {sections.map((s) => (
            <section key={s.month} aria-label={monthLabel(s.month)}>
              <div className="mb-3 flex items-end justify-between gap-3 px-1">
                <h2 className="text-xl font-semibold capitalize">{monthName(s.month)}</h2>
                <p className="flex gap-3 text-xs text-muted-foreground">
                  <span>
                    entrou <Money value={s.income} className="font-semibold text-income" />
                  </span>
                  <span>
                    saiu <Money value={s.expense} className="font-semibold text-foreground" />
                  </span>
                </p>
              </div>

              <div className="space-y-4">
                {s.days.map(([day, txs]) => {
                  const net = txs.reduce((a, t) => a + (t.kind === "income" ? t.amount : -t.amount), 0);
                  return (
                    <div key={day}>
                      <p className="mb-1.5 flex justify-between px-1 text-xs font-medium text-muted-foreground">
                        <span>{relativeDay(day, today)}</span>
                        <Money value={net} sign={net >= 0 ? "+" : "−"} className={cn(net > 0 && "text-income")} />
                      </p>
                      <ul className="surface divide-y divide-border overflow-hidden">{txs.map(renderRow)}</ul>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

          {totalMonths > months && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => setMonths((m) => m + 3)}>
                Mostrar meses anteriores
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Chip({ active, onClick, children, className }: { active: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors",
        active ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}
