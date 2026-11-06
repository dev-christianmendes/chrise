import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowUpRight, CheckCircle2, ChevronDown, Info, OctagonAlert } from "lucide-react";
import {
  addMonths,
  budgetStatus,
  buildInsights,
  currentBalance,
  forecast,
  formatBRLCompact,
  formatPercent,
  monthlyAllowance,
  monthlySeries,
  projectBalance,
  simplesForMonth,
  toYearMonth,
  type Category,
  type CategoryGroup,
  type Insight,
  type Transaction,
} from "@chrise/core";
import { CategoryBadge, Money, Ring, SectionTitle, Sparkline } from "@/components/kit";
import { ErrorState, PageSkeleton } from "@/components/states";
import { useSnapshot } from "@/hooks/use-finance";
import { GROUP_LABEL, groupColor } from "@/lib/category-style";
import { greeting, monthName, relativeDay, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const { snapshot, isLoading, error } = useSnapshot();
  const today = todayISO();

  const model = useMemo(() => {
    if (!snapshot) return null;
    const { month, transactions, categories, accounts, budgets } = snapshot;
    const lastClosed = addMonths(month, -1);
    const balance = currentBalance(accounts.map((a) => a.openingBalance), transactions);
    const history = monthlySeries(transactions, lastClosed, 12);
    const inc = forecast(history.map((m) => m.income), { horizon: 6 });
    const exp = forecast(history.map((m) => m.expense), { horizon: 6 });
    const projection = projectBalance(balance, inc, exp);

    // Saldo ao fim de cada um dos últimos 6 meses (reconstruído de trás pra frente) + projeção.
    const pastBalances: number[] = [balance];
    for (const m of [...history].reverse().slice(0, 5)) pastBalances.unshift(pastBalances[0]! - m.balance);

    const byCategory = new Map(categories.map((c) => [c.id, c]));

    // Gastos do mês por GRUPO (cor = grupo).
    const groups = new Map<CategoryGroup, number>();
    for (const t of transactions) {
      if (t.kind !== "expense" || toYearMonth(t.date) !== month || t.date > today) continue;
      const g = byCategory.get(t.categoryId)?.group ?? "outros";
      groups.set(g, (groups.get(g) ?? 0) + t.amount);
    }
    const spentTotal = [...groups.values()].reduce((a, b) => a + b, 0);
    const spending = [...groups.entries()].sort((a, b) => b[1] - a[1]).map(([group, total]) => ({ group, total, share: spentTotal ? total / spentTotal : 0 }));

    const limits = budgets
      .filter((b) => b.month === month)
      .map((b) => ({ ...budgetStatus(b, transactions), category: byCategory.get(b.categoryId) }))
      .sort((a, b) => b.ratio - a.ratio);

    return {
      allowance: monthlyAllowance(snapshot, today),
      tax: simplesForMonth(snapshot),
      in6: projection.at(-1)!,
      sparkline: [...pastBalances, ...projection.map((p) => p.balance)],
      sparkSplit: pastBalances.length - 1,
      spending,
      spentTotal,
      limits,
      insights: buildInsights(snapshot).filter((i) => i.level !== "positive"),
      positives: buildInsights(snapshot).filter((i) => i.level === "positive"),
      recent: transactions.filter((t) => t.date <= today).slice(0, 8),
      byCategory,
    };
  }, [snapshot, today]);

  if (error) return <ErrorState error={error} />;
  if (isLoading || !model || !snapshot) return <PageSkeleton />;

  const { allowance: a } = model;
  const negative = a.free < 0;
  const ahead = a.spentRatio > a.monthProgress + 0.08;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
      {/* ——— Coluna principal ——— */}
      <div className="min-w-0 space-y-5 lg:col-span-7">
        <header className="animate-rise px-1">
          <p className="eyebrow">{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</p>
          <h1 className="mt-1 text-[1.9rem] font-semibold leading-none md:text-4xl">{greeting()}.</h1>
        </header>

        {/* O COFRE: a resposta do dia */}
        <section className="vault animate-rise p-5 pb-4 md:p-7 [animation-delay:60ms]" aria-label="Livre para gastar">
          <div className="relative z-10">
            <p className="text-sm text-white/60">
              Livre para gastar em <span className="text-white/90">{monthName(snapshot.month)}</span>
            </p>
            <Money
              value={a.free}
              sign="auto"
              className={cn("mt-1 block text-[3.1rem] font-semibold leading-[1.05] md:text-6xl", negative ? "text-[hsl(6_90%_68%)]" : "text-lime")}
            />
            <p className="mt-1.5 text-[0.95rem] text-white/75">
              {negative ? (
                <>Você passou do disponível do mês. Segure os gastos variáveis.</>
              ) : (
                <>
                  ≈ <Money value={a.perDay} className="font-semibold text-white" /> por dia ·{" "}
                  {a.daysLeft === 1 ? "último dia" : `${a.daysLeft} dias restantes`}
                </>
              )}
            </p>

            {/* Ritmo: quanto do disponível já foi × quanto do mês já passou */}
            <div className="mt-5">
              <div className="relative h-2.5 rounded-full bg-white/10">
                <div
                  className={cn("absolute inset-y-0 left-0 rounded-full transition-[width] duration-700", ahead ? "bg-[hsl(40_95%_60%)]" : "bg-lime")}
                  style={{ width: `${Math.min(100, a.spentRatio * 100)}%` }}
                />
                <div
                  className="absolute -top-1 h-[1.125rem] w-[3px] -translate-x-1/2 rounded-full bg-white shadow-[0_0_0_3px_hsl(30_8%_8%)]"
                  style={{ left: `${a.monthProgress * 100}%` }}
                  title="Hoje"
                />
              </div>
              <p className="mt-2 flex justify-between text-xs text-white/55">
                <span>
                  {formatPercent(Math.min(a.spentRatio, 9.99), 0)} do disponível usado
                </span>
                <span className={cn(ahead && "text-[hsl(40_95%_65%)]")}>{ahead ? "acima do ritmo" : "no ritmo"} · mês em {formatPercent(a.monthProgress, 0)}</span>
              </p>
            </div>

            {/* A conta, às claras */}
            <dl className="mt-5 grid grid-cols-4 gap-2 border-t border-white/10 pt-4 text-[11px] text-white/55">
              {[
                ["Entrou", a.income, "text-white"],
                ["Imposto", -a.taxReserve, "text-white/85"],
                ["Fixas", -a.committed, "text-white/85"],
                ["Gasto", -a.spent, "text-white/85"],
              ].map(([label, value, tone]) => (
                <div key={label as string} className="min-w-0">
                  <dt>{label as string}</dt>
                  <dd className={cn("money mt-0.5 truncate text-[0.95rem] font-medium", tone as string)}>
                    {(value as number) < 0 ? "−" : ""}
                    {formatBRLCompact(Math.abs(value as number)).replace("R$", "").trim()}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Atalhos que respondem as outras duas perguntas */}
        <div className="grid grid-cols-2 gap-3 animate-rise [animation-delay:120ms]">
          <Link to="/taxes" className="surface group flex flex-col justify-between p-4 transition-colors hover:bg-muted/40">
            <div className="flex items-start justify-between">
              <span className="text-sm text-muted-foreground">Separar p/ imposto</span>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </div>
            <div className="mt-3">
              <Money value={model.tax.totalReserve} className="block text-2xl font-semibold" />
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                    model.tax.anexo === "III" ? "bg-income/15 text-income" : "bg-danger/15 text-danger",
                  )}
                >
                  ANEXO {model.tax.anexo}
                </span>
                DAS dia 20
              </p>
            </div>
          </Link>

          <Link to="/forecast" className="surface group flex flex-col justify-between p-4 transition-colors hover:bg-muted/40">
            <div className="flex items-start justify-between">
              <span className="text-sm text-muted-foreground">Saldo em 6 meses</span>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </div>
            <Sparkline values={model.sparkline} dashedFrom={model.sparkSplit} color="hsl(var(--income))" height={30} className="mt-2" />
            <div className="mt-1">
              <span className="money block text-2xl font-semibold">{formatBRLCompact(model.in6.balance)}</span>
              <p className="mt-1 text-xs text-muted-foreground">no ritmo atual</p>
            </div>
          </Link>
        </div>

        <Alerts insights={model.insights} positives={model.positives} />
      </div>

      {/* ——— Coluna lateral (desktop) / continuação (celular) ——— */}
      <div className="min-w-0 space-y-6 lg:col-span-5 lg:pt-[4.5rem]">
        {model.limits.length > 0 && (
          <section className="animate-rise [animation-delay:180ms]">
            <SectionTitle title="Limites do mês" to="/budgets" action="Ajustar" />
            <div className="rail -mx-4 px-4 pb-1 lg:mx-0 lg:grid lg:grid-cols-2 lg:px-0">
              {model.limits.map((l) => {
                const color = l.level === "over" ? "hsl(var(--danger))" : l.level === "warning" ? "hsl(var(--warning))" : groupColor(l.category?.group);
                return (
                  <Link key={l.budget.id} to="/budgets" className="surface flex w-[9.5rem] shrink-0 flex-col gap-3 p-3.5 lg:w-auto">
                    <Ring value={l.ratio} size={46} stroke={5} color={color}>
                      <span className="text-[11px] font-bold tabular-nums">{Math.round(l.ratio * 100)}%</span>
                    </Ring>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{l.category?.name ?? l.budget.categoryId}</p>
                      <p className={cn("text-xs tabular-nums", l.remaining < 0 ? "text-danger" : "text-muted-foreground")}>
                        {l.remaining < 0 ? `passou ${formatBRLCompact(-l.remaining)}` : `restam ${formatBRLCompact(l.remaining)}`}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {model.spending.length > 0 && (
          <section className="animate-rise [animation-delay:220ms]">
            <SectionTitle title="Para onde foi" to="/transactions" />
            <div className="surface p-4">
              <p className="flex items-baseline justify-between text-sm text-muted-foreground">
                Gasto até hoje
                <Money value={model.spentTotal} className="text-lg font-semibold text-foreground" />
              </p>
              <div className="mt-3 flex h-3 gap-[3px] overflow-hidden rounded-full">
                {model.spending.map((s) => (
                  <div key={s.group} style={{ flexGrow: s.share, background: groupColor(s.group) }} className="min-w-[4px] first:rounded-l-full last:rounded-r-full" />
                ))}
              </div>
              <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5">
                {model.spending.slice(0, 6).map((s) => (
                  <li key={s.group} className="flex items-center gap-2 text-sm">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: groupColor(s.group) }} />
                    <span className="min-w-0 flex-1 truncate">{GROUP_LABEL[s.group]}</span>
                    <span className="tabular-nums text-muted-foreground">{formatPercent(s.share, 0)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <section className="animate-rise [animation-delay:260ms]">
          <SectionTitle title="Últimos lançamentos" to="/transactions" />
          <RecentList transactions={model.recent} byCategory={model.byCategory} today={today} />
        </section>
      </div>
    </div>
  );
}

const ALERT_STYLE: Record<Insight["level"], { icon: typeof Info; tone: string }> = {
  danger: { icon: OctagonAlert, tone: "text-danger" },
  warning: { icon: AlertTriangle, tone: "text-warning" },
  info: { icon: Info, tone: "text-info" },
  positive: { icon: CheckCircle2, tone: "text-income" },
};

/** Um card só, que resume e expande — em vez de uma parede de alertas. */
function Alerts({ insights, positives }: { insights: Insight[]; positives: Insight[] }) {
  const [open, setOpen] = useState(false);
  if (insights.length === 0) {
    const p = positives[0];
    return (
      <div className="surface flex items-center gap-3 p-4">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-income" />
        <p className="text-sm">{p ? p.title : "Tudo em ordem por aqui."}</p>
      </div>
    );
  }
  const worst = insights[0]!;
  const { icon: Icon, tone } = ALERT_STYLE[worst.level];
  return (
    <section className="surface overflow-hidden animate-rise [animation-delay:160ms]">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-3 p-4 text-left">
        <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-[0.85rem] bg-current/10", tone)} style={{ backgroundColor: "color-mix(in srgb, currentColor 14%, transparent)" }}>
          <Icon className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">
            {insights.length === 1 ? "1 ponto de atenção" : `${insights.length} pontos de atenção`}
          </span>
          <span className="block truncate text-sm text-muted-foreground">{worst.title}</span>
        </span>
        <ChevronDown className={cn("h-5 w-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ul className="divide-y divide-border border-t border-border">
          {insights.map((ins) => {
            const s = ALERT_STYLE[ins.level];
            return (
              <li key={ins.id} className="flex gap-3 px-4 py-3.5">
                <s.icon className={cn("mt-0.5 h-4 w-4 shrink-0", s.tone)} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{ins.title}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{ins.message}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function RecentList({ transactions, byCategory, today }: { transactions: Transaction[]; byCategory: Map<string, Category>; today: string }) {
  if (transactions.length === 0) return <p className="surface p-6 text-center text-sm text-muted-foreground">Nenhum lançamento ainda. Toque em + para começar.</p>;
  return (
    <ul className="surface divide-y divide-border">
      {transactions.map((t) => {
        const category = byCategory.get(t.categoryId);
        return (
          <li key={t.id} className="flex items-center gap-3 px-4 py-3">
            <CategoryBadge category={category} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.95rem] font-medium">{t.description}</p>
              <p className="truncate text-xs text-muted-foreground">
                {category?.name} · {relativeDay(t.date, today)}
              </p>
            </div>
            <Money value={t.amount} sign={t.kind === "income" ? "+" : "−"} className={cn("text-[0.95rem] font-semibold", t.kind === "income" && "text-income")} />
          </li>
        );
      })}
    </ul>
  );
}
