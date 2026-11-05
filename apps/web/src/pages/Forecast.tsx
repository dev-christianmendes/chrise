import { useMemo, useState } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  addMonths,
  annualToMonthlyRate,
  currentBalance,
  forecast,
  formatBRL,
  formatBRLCompact,
  futureValue,
  lastMonths,
  linearRegression,
  monthLabel,
  monthlySeries,
  monthsToGoal,
  projectBalance,
  toCents,
  toYearMonth,
} from "@chrise/core";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/Layout";
import { ErrorState, PageSkeleton } from "@/components/states";
import { useSnapshot } from "@/hooks/use-finance";
import { cn } from "@/lib/utils";

const tooltipStyle = { backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)" };

function NumberField({ id, label, value, onChange, suffix }: { id: string; label: string; value: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <div className="relative">
        <Input id={id} type="number" inputMode="decimal" value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} className="pr-10 tabular-nums" />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}

export default function Forecast() {
  const { snapshot, isLoading, error } = useSnapshot();

  const [contribution, setContribution] = useState(2000);
  const [annualRate, setAnnualRate] = useState(10);
  const [years, setYears] = useState(10);
  const [goal, setGoal] = useState(1_000_000);

  const model = useMemo(() => {
    if (!snapshot) return null;
    const { month, transactions, categories, accounts } = snapshot;
    const lastClosed = addMonths(month, -1);
    const history = monthlySeries(transactions, lastClosed, 24);
    const balance = currentBalance(accounts.map((a) => a.openingBalance), transactions);
    const inc = forecast(history.map((m) => m.income), { horizon: 12 });
    const exp = forecast(history.map((m) => m.expense), { horizon: 12 });
    const projection = projectBalance(balance, inc, exp).map((p) => ({
      label: monthLabel(addMonths(lastClosed, p.step)),
      saldo: p.balance,
      faixa: [p.low, p.high] as [number, number],
    }));

    // Previsão do próximo mês por categoria + tendência
    const window = lastMonths(lastClosed, 12);
    const byCategory = categories
      .filter((c) => c.kind === "expense")
      .map((c) => {
        const series = window.map((m) =>
          transactions.filter((t) => t.categoryId === c.id && t.kind === "expense" && toYearMonth(t.date) === m).reduce((a, t) => a + t.amount, 0),
        );
        const avg = series.reduce((a, b) => a + b, 0) / series.length;
        const next = forecast(series, { horizon: 1 })[0]!;
        const reg = linearRegression(series);
        const trendPct = avg > 0 ? (reg.slope * 12) / avg : 0; // variação anualizada
        return { category: c, avg, next: next.value, trendPct, r2: reg.r2 };
      })
      .filter((x) => x.avg > 0)
      .sort((a, b) => b.next - a.next)
      .slice(0, 10);

    return { projection, byCategory, balance };
  }, [snapshot]);

  if (error) return <ErrorState error={error} />;
  if (isLoading || !model) return <PageSkeleton />;

  const months = years * 12;
  const rate = annualToMonthlyRate(annualRate / 100);
  const start = Math.max(0, model.balance);
  const fvCents = futureValue(start, toCents(contribution), rate, months);
  const invested = start + toCents(contribution) * months;
  const toGoal = monthsToGoal(start, toCents(goal), toCents(contribution), rate);

  return (
    <div className="space-y-6">
      <PageHeader title="Previsões" subtitle="Estatística sobre o seu histórico: tendência, sazonalidade e faixa de confiança de 80%." />

      <Card className="p-4 md:p-6">
        <h2 className="font-semibold mb-4">Saldo nos próximos 12 meses</h2>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={model.projection} margin={{ left: 0, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} tickFormatter={(v) => formatBRLCompact(v)} width={84} />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(v: number | [number, number], name) => (Array.isArray(v) ? [`${formatBRL(v[0])} a ${formatBRL(v[1])}`, "Faixa 80%"] : [formatBRL(v), name])}
            />
            <Area dataKey="faixa" stroke="none" fill="hsl(var(--primary))" fillOpacity={0.15} />
            <Line dataKey="saldo" name="Saldo" stroke="hsl(var(--primary))" strokeWidth={2} />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      <Card className="p-4 md:p-6">
        <h2 className="font-semibold mb-1">Próximo mês, por categoria</h2>
        <p className="text-xs text-muted-foreground mb-4">Tendência = inclinação dos últimos 12 meses, anualizada.</p>
        <div className="divide-y divide-border">
          {model.byCategory.map(({ category, avg, next, trendPct, r2 }) => (
            <div key={category.id} className="flex items-center gap-3 py-2.5 text-sm">
              <span className="flex-1 truncate">{category.name}</span>
              <span className="hidden sm:block w-28 text-right text-muted-foreground tabular-nums">média {formatBRLCompact(avg)}</span>
              <span className="w-24 text-right font-semibold tabular-nums">{formatBRL(next)}</span>
              <span
                title={`R² ${r2.toFixed(2)}`}
                className={cn(
                  "w-16 text-right text-xs tabular-nums",
                  r2 < 0.2 || Math.abs(trendPct) < 0.05 ? "text-muted-foreground" : trendPct > 0.05 ? "text-danger" : trendPct < -0.05 ? "text-success" : "text-muted-foreground",
                )}
              >
                {r2 < 0.2 || Math.abs(trendPct) < 0.05 ? "estável" : `${trendPct > 0 ? "▲" : "▼"} ${Math.abs(trendPct * 100).toFixed(0)}%`}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4 md:p-6">
        <h2 className="font-semibold mb-4">Simulador de longo prazo</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <NumberField id="aporte" label="Aporte mensal" value={contribution} onChange={setContribution} suffix="R$" />
          <NumberField id="taxa" label="Rentabilidade anual" value={annualRate} onChange={setAnnualRate} suffix="%" />
          <NumberField id="anos" label="Prazo" value={years} onChange={(v) => setYears(Math.min(50, Math.max(1, v)))} suffix="anos" />
          <NumberField id="meta" label="Meta" value={goal} onChange={setGoal} suffix="R$" />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-muted p-4">
            <p className="text-xs text-muted-foreground">Patrimônio em {years} anos</p>
            <p className="text-2xl font-bold tabular-nums text-success">{formatBRL(fvCents)}</p>
          </div>
          <div className="rounded-lg bg-muted p-4">
            <p className="text-xs text-muted-foreground">Total aportado (com saldo atual)</p>
            <p className="text-2xl font-bold tabular-nums">{formatBRL(invested)}</p>
            <p className="text-xs text-muted-foreground mt-1">Juros: {formatBRL(fvCents - invested)}</p>
          </div>
          <div className="rounded-lg bg-muted p-4">
            <p className="text-xs text-muted-foreground">Tempo até a meta de {formatBRLCompact(toCents(goal))}</p>
            <p className="text-2xl font-bold tabular-nums">
              {toGoal === Infinity ? "—" : toGoal === 0 ? "Já bateu!" : `${Math.floor(toGoal / 12)}a ${toGoal % 12}m`}
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-4">Valores nominais, sem descontar inflação nem IR sobre rendimentos.</p>
      </Card>
    </div>
  );
}
