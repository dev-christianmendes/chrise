import { useMemo, useState } from "react";
import { Area, Bar, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingDown, TrendingUp } from "lucide-react";
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
import { CategoryBadge, Money, PageTitle, SectionTitle } from "@/components/kit";
import { ErrorState, PageSkeleton } from "@/components/states";
import { useSnapshot } from "@/hooks/use-finance";
import { cn } from "@/lib/utils";

const axis = { stroke: "hsl(var(--muted-foreground))", fontSize: 11, tickLine: false, axisLine: false } as const;

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number | [number, number]; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border border-border bg-popover px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-semibold">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex justify-between gap-4 text-muted-foreground">
          <span>{p.name}</span>
          <span className="money font-medium text-foreground">{Array.isArray(p.value) ? `${formatBRLCompact(p.value[0])} – ${formatBRLCompact(p.value[1])}` : formatBRL(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

function Field({ id, label, value, onChange, prefix, suffix }: { id: string; label: string; value: number; onChange: (v: number) => void; prefix?: string; suffix?: string }) {
  return (
    <label htmlFor={id} className="block rounded-2xl bg-muted px-3.5 py-2.5">
      <span className="block text-[11px] text-muted-foreground">{label}</span>
      <span className="flex items-baseline gap-1">
        {prefix && <span className="text-sm text-muted-foreground">{prefix}</span>}
        <input
          id={id}
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="money w-full min-w-0 bg-transparent text-lg font-semibold outline-none"
        />
        {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
      </span>
    </label>
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
    const raw = projectBalance(balance, inc, exp);
    const projection = [
      { label: "Hoje", saldo: balance, faixa: [balance, balance] as [number, number] },
      ...raw.map((p) => ({ label: monthLabel(addMonths(lastClosed, p.step)), saldo: p.balance, faixa: [p.low, p.high] as [number, number] })),
    ];

    const flows = [
      ...history.slice(-12).map((m) => ({ label: monthLabel(m.month), entrou: m.income, saiu: m.expense })),
      ...inc.slice(0, 6).map((p, i) => ({ label: monthLabel(addMonths(lastClosed, i + 1)), entrouPrev: p.value, saiuPrev: exp[i]!.value })),
    ];

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
        const trendPct = avg > 0 ? (reg.slope * 12) / avg : 0;
        return { category: c, avg, next: next.value, trendPct, r2: reg.r2 };
      })
      .filter((x) => x.avg > 0)
      .sort((a, b) => b.next - a.next)
      .slice(0, 8);

    return { projection, end: raw.at(-1)!, flows, byCategory, balance };
  }, [snapshot]);

  if (error) return <ErrorState error={error} />;
  if (isLoading || !model) return <PageSkeleton />;

  const months = years * 12;
  const rate = annualToMonthlyRate(annualRate / 100);
  const start = Math.max(0, model.balance);
  const fvCents = futureValue(start, toCents(contribution), rate, months);
  const invested = start + toCents(contribution) * months;
  const toGoal = monthsToGoal(start, toCents(goal), toCents(contribution), rate);
  const growth = model.end.balance - model.balance;

  return (
    <div className="mx-auto max-w-5xl">
      <PageTitle eyebrow="Previsões sobre o seu histórico" title="Futuro" />

      {/* Saldo em 12 meses */}
      <section className="surface overflow-hidden animate-rise">
        <div className="p-5 pb-0 md:p-6 md:pb-0">
          <p className="text-sm text-muted-foreground">Saldo em 12 meses, no ritmo atual</p>
          <Money value={model.end.balance} className="mt-1 block text-[2.4rem] font-semibold leading-none" />
          <p className={cn("mt-2 inline-flex items-center gap-1 text-sm font-semibold", growth >= 0 ? "text-income" : "text-danger")}>
            {growth >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            {growth >= 0 ? "+" : "−"}
            {formatBRLCompact(Math.abs(growth))} em relação a hoje
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            80% de chance de ficar entre {formatBRLCompact(model.end.low)} e {formatBRLCompact(model.end.high)}
          </p>
        </div>
        <div className="mt-4 h-56 md:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={model.projection} margin={{ left: 20, right: 28, top: 8, bottom: 4 }}>
              <defs>
                <linearGradient id="band" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--income))" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="hsl(var(--income))" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={24} />
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: "hsl(var(--border))" }} />
              <Area dataKey="faixa" name="Faixa 80%" stroke="none" fill="url(#band)" />
              <Line dataKey="saldo" name="Saldo" stroke="hsl(var(--income))" strokeWidth={3} dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-6">
        {/* Entradas × saídas */}
        <section className="min-w-0 animate-rise [animation-delay:80ms]">
          <SectionTitle title="Entradas × saídas" />
          <div className="surface p-4">
            <div className="mb-2 flex gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-income" /> entrou
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-muted-foreground" /> saiu
              </span>
              <span className="ml-auto">tracejado = previsão</span>
            </div>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={model.flows} margin={{ left: 0, right: 4, top: 8 }} barGap={2}>
                  <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={20} />
                  <YAxis {...axis} width={44} tickFormatter={(v) => formatBRLCompact(v).replace("R$", "").trim()} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(var(--muted))" }} />
                  <Bar dataKey="entrou" name="Entrou" fill="hsl(var(--income))" radius={[5, 5, 2, 2]} maxBarSize={12} />
                  <Bar dataKey="saiu" name="Saiu" fill="hsl(var(--muted-foreground))" radius={[5, 5, 2, 2]} maxBarSize={12} />
                  <Line dataKey="entrouPrev" name="Entrada prevista" stroke="hsl(var(--income))" strokeDasharray="4 4" strokeWidth={2} dot={false} />
                  <Line dataKey="saiuPrev" name="Saída prevista" stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* Próximo mês por categoria */}
        <section className="min-w-0 animate-rise [animation-delay:120ms]">
          <SectionTitle title="Próximo mês" />
          <ul className="surface divide-y divide-border">
            {model.byCategory.map(({ category, avg, next, trendPct, r2 }) => {
              const stable = r2 < 0.2 || Math.abs(trendPct) < 0.05;
              return (
                <li key={category.id} className="flex items-center gap-3 px-4 py-3">
                  <CategoryBadge category={category} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{category.name}</span>
                    <span className="text-xs text-muted-foreground">média {formatBRLCompact(avg)}</span>
                  </span>
                  <span className="text-right">
                    <Money value={next} className="block text-sm font-semibold" />
                    <span
                      title={`R² ${r2.toFixed(2)}`}
                      className={cn("text-[11px] font-medium", stable ? "text-muted-foreground" : trendPct > 0 ? "text-danger" : "text-income")}
                    >
                      {stable ? "estável" : `${trendPct > 0 ? "▲" : "▼"} ${Math.abs(trendPct * 100).toFixed(0)}% ao ano`}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {/* Simulador */}
      <section className="mt-8 animate-rise [animation-delay:160ms]">
        <SectionTitle title="Simulador de longo prazo" />
        <div className="surface p-4 md:p-6">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Field id="aporte" label="Aporte mensal" value={contribution} onChange={setContribution} prefix="R$" />
            <Field id="taxa" label="Rentabilidade anual" value={annualRate} onChange={setAnnualRate} suffix="%" />
            <Field id="anos" label="Prazo" value={years} onChange={(v) => setYears(Math.min(50, Math.max(1, v)))} suffix="anos" />
            <Field id="meta" label="Meta" value={goal} onChange={setGoal} prefix="R$" />
          </div>

          <div className="vault mt-4 p-5">
            <div className="relative z-10 grid gap-5 sm:grid-cols-3">
              <div>
                <p className="text-xs text-white/55">Patrimônio em {years} anos</p>
                <Money value={fvCents} className="mt-1 block text-3xl font-semibold text-lime" />
              </div>
              <div>
                <p className="text-xs text-white/55">Você aporta</p>
                <Money value={invested} className="mt-1 block text-xl font-semibold" />
                <p className="text-xs text-white/55">
                  juros fazem <span className="text-white/85">{formatBRLCompact(fvCents - invested)}</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-white/55">Até a meta de {formatBRLCompact(toCents(goal))}</p>
                <p className="money mt-1 text-xl font-semibold">
                  {toGoal === Infinity ? "—" : toGoal === 0 ? "Já bateu!" : `${Math.floor(toGoal / 12)} anos e ${toGoal % 12} meses`}
                </p>
              </div>
            </div>
          </div>
          <p className="mt-3 px-1 text-xs text-muted-foreground">Valores nominais, sem descontar inflação nem IR sobre rendimentos.</p>
        </div>
      </section>
    </div>
  );
}
