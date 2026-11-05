import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Area, CartesianGrid, ComposedChart, Line, Pie, PieChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, PiggyBank, TrendingDown, TrendingUp } from "lucide-react";
import {
  addMonths,
  buildInsights,
  currentBalance,
  expensesByCategory,
  forecast,
  formatBRL,
  formatBRLCompact,
  formatPercent,
  monthLabel,
  monthlySeries,
  projectBalance,
  summarizeMonth,
  toYearMonth,
} from "@chrise/core";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InsightList } from "@/components/InsightList";
import { PageHeader } from "@/components/Layout";
import { StatCard } from "@/components/StatCard";
import { ErrorState, PageSkeleton } from "@/components/states";
import { useSnapshot } from "@/hooks/use-finance";

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "var(--radius)",
  color: "hsl(var(--foreground))",
};

export default function Dashboard() {
  const { snapshot, isLoading, error } = useSnapshot();

  const model = useMemo(() => {
    if (!snapshot) return null;
    const { month, transactions, categories, accounts } = snapshot;
    const lastClosed = addMonths(month, -1);
    const balance = currentBalance(accounts.map((a) => a.openingBalance), transactions);
    const current = summarizeMonth(transactions, month);
    const history = monthlySeries(transactions, lastClosed, 12);

    const inc = forecast(history.map((m) => m.income), { horizon: 6 });
    const exp = forecast(history.map((m) => m.expense), { horizon: 6 });
    const projection = projectBalance(balance, inc, exp);

    const chart = [
      ...history.map((m) => ({ label: monthLabel(m.month), receita: m.income, despesa: m.expense })),
      ...projection.map((p, i) => ({
        label: monthLabel(addMonths(lastClosed, p.step)),
        receitaPrev: inc[i]!.value,
        despesaPrev: exp[i]!.value,
      })),
    ];

    const balanceChart = projection.map((p) => ({
      label: monthLabel(addMonths(lastClosed, p.step)),
      saldo: p.balance,
      faixa: [p.low, p.high] as [number, number],
    }));

    return {
      balance,
      current,
      prev: summarizeMonth(transactions, lastClosed),
      chart,
      balanceChart,
      in6: projection.at(-1)!,
      slices: expensesByCategory(transactions, categories, month).slice(0, 6),
      insights: buildInsights(snapshot),
      recent: transactions.filter((t) => toYearMonth(t.date) <= month && t.status === "paid").slice(0, 6),
      categoryName: new Map(categories.map((c) => [c.id, c.name])),
    };
  }, [snapshot]);

  if (error) return <ErrorState error={error} />;
  if (isLoading || !model) return <PageSkeleton />;

  const { balance, current, prev, chart, balanceChart, in6, slices, insights, recent, categoryName } = model;

  return (
    <div className="space-y-6">
      <PageHeader title="Visão geral" subtitle={`${monthLabel(snapshot!.month)} · mês em andamento`} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Saldo atual" value={formatBRL(balance)} icon={PiggyBank} hint={`Em 6 meses: ${formatBRLCompact(in6.balance)}`} />
        <StatCard title="Receitas do mês" value={formatBRL(current.income)} icon={TrendingUp} variant="success" />
        <StatCard title="Despesas do mês" value={formatBRL(current.expense)} icon={TrendingDown} variant="danger" />
        <StatCard
          title="Poupança (mês passado)"
          value={formatPercent(prev.savingsRate, 0)}
          icon={Activity}
          variant={prev.savingsRate >= 0.2 ? "success" : prev.savingsRate >= 0.1 ? "warning" : "danger"}
          hint={`${formatBRL(prev.balance)} guardados`}
        />
      </div>

      <InsightList insights={insights} limit={4} />

      <Card className="p-4 md:p-6">
        <div className="flex items-baseline justify-between mb-4 gap-2">
          <h2 className="font-semibold">Receitas × despesas</h2>
          <span className="text-xs text-muted-foreground">12 meses + previsão de 6</span>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={chart} margin={{ left: 0, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} interval="preserveStartEnd" />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} tickFormatter={(v) => formatBRLCompact(v)} width={84} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatBRL(v)} />
            <Line dataKey="receita" name="Receita" stroke="hsl(var(--success))" strokeWidth={2} dot={false} />
            <Line dataKey="despesa" name="Despesa" stroke="hsl(var(--danger))" strokeWidth={2} dot={false} />
            <Line dataKey="receitaPrev" name="Receita (prev.)" stroke="hsl(var(--success))" strokeDasharray="5 4" strokeWidth={2} dot={false} />
            <Line dataKey="despesaPrev" name="Despesa (prev.)" stroke="hsl(var(--danger))" strokeDasharray="5 4" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="p-4 md:p-6 lg:col-span-3">
          <div className="flex items-baseline justify-between mb-4 gap-2">
            <h2 className="font-semibold">Saldo projetado</h2>
            <Link to="/forecast" className="text-xs text-primary">Detalhes →</Link>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={balanceChart} margin={{ left: 0, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} tickFormatter={(v) => formatBRLCompact(v)} width={84} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: number | [number, number], name) =>
                  Array.isArray(v) ? [`${formatBRL(v[0])} a ${formatBRL(v[1])}`, "Faixa 80%"] : [formatBRL(v), name]
                }
              />
              <Area dataKey="faixa" stroke="none" fill="hsl(var(--primary))" fillOpacity={0.15} />
              <Line dataKey="saldo" name="Saldo" stroke="hsl(var(--primary))" strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-4 md:p-6 lg:col-span-2">
          <h2 className="font-semibold mb-2">Para onde vai o dinheiro</h2>
          {slices.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem despesas neste mês ainda.</p>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="45%" height={160}>
                <PieChart>
                  <Pie data={slices} dataKey="total" nameKey="category.name" innerRadius="60%" outerRadius="100%" paddingAngle={2}>
                    {slices.map((s, i) => (
                      <Cell key={s.category.id} fill={`hsl(var(--chart-${(i % 5) + 1}))`} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatBRL(v)} />
                </PieChart>
              </ResponsiveContainer>
              <ul className="flex-1 space-y-1.5 text-sm min-w-0">
                {slices.map((s, i) => (
                  <li key={s.category.id} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: `hsl(var(--chart-${(i % 5) + 1}))` }} />
                    <span className="truncate flex-1">{s.category.name}</span>
                    <span className="tabular-nums text-muted-foreground">{formatPercent(s.share, 0)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>

      <Card className="p-4 md:p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Últimos lançamentos</h2>
          <Button variant="link" asChild className="px-0 h-auto">
            <Link to="/transactions">Ver todos →</Link>
          </Button>
        </div>
        <ul className="divide-y divide-border">
          {recent.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{t.description}</p>
                <p className="text-xs text-muted-foreground">
                  {categoryName.get(t.categoryId)} · {new Date(`${t.date}T12:00:00`).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <span className={`text-sm font-semibold tabular-nums ${t.kind === "income" ? "text-success" : "text-danger"}`}>
                {t.kind === "income" ? "+" : "−"}
                {formatBRL(t.amount)}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
