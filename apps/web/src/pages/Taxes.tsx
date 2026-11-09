import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import {
  addMonths,
  businessRevenueByMonth,
  calculateSimples,
  FATOR_R_THRESHOLD,
  formatBRL,
  formatBRLCompact,
  formatPercent,
  INSS_PARAMS,
  lastMonths,
  monthLabel,
  simplesForMonth,
  toCents,
} from "@chrise/core";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Money, PageTitle, Ring, SectionTitle } from "@/components/kit";
import { ErrorState, PageSkeleton } from "@/components/states";
import { useSaveTaxProfile, useSnapshot } from "@/hooks/use-finance";
import { monthName } from "@/lib/format";
import { cn } from "@/lib/utils";

const PART = {
  das: { label: "DAS", color: "hsl(var(--g-impostos))" },
  inss: { label: "INSS", color: "hsl(var(--warning))" },
  extra: { label: "Reserva extra", color: "hsl(var(--g-outros))" },
  free: { label: "Fica pra você", color: "hsl(var(--income))" },
};

export default function Taxes() {
  const { snapshot, isLoading, error } = useSnapshot();
  const save = useSaveTaxProfile();
  const [simProLabore, setSimProLabore] = useState<number | null>(null);

  useEffect(() => {
    if (snapshot && simProLabore === null) setSimProLabore(snapshot.taxProfile.proLabore);
  }, [snapshot, simProLabore]);

  const model = useMemo(() => {
    if (!snapshot || simProLabore === null) return null;
    const actual = simplesForMonth(snapshot);
    const simulated = simplesForMonth({ ...snapshot, taxProfile: { ...snapshot.taxProfile, proLabore: simProLabore } });

    // DAS + INSS estimados nos últimos 12 meses fechados.
    const months = lastMonths(addMonths(snapshot.month, -1), 12);
    const revenue = businessRevenueByMonth(snapshot.transactions, lastMonths(addMonths(snapshot.month, -1), 24));
    const history = months.map((m, i) => {
      const r = calculateSimples({
        monthRevenue: revenue[12 + i]!,
        previousRevenues: revenue.slice(i, 12 + i).filter((v) => v > 0),
        proLabore: snapshot.taxProfile.proLabore,
      });
      return { month: m, das: r.das, inss: r.inss, anexo: r.anexo };
    });
    return { actual, simulated, history };
  }, [snapshot, simProLabore]);

  if (error) return <ErrorState error={error} />;
  if (isLoading || !model || !snapshot || simProLabore === null) return <PageSkeleton />;

  const { actual, simulated, history } = model;
  const revenue = actual.netAfterTaxes + actual.totalReserve;
  const parts = [
    { key: "das", value: actual.das },
    { key: "inss", value: actual.inss },
    { key: "extra", value: actual.extraReserve },
    { key: "free", value: Math.max(0, actual.netAfterTaxes) },
  ] as const;

  const totalActual = actual.das + actual.inss;
  const totalSim = simulated.das + simulated.inss;
  const diff = totalActual - totalSim;
  const max = Math.max(toCents(15_000), actual.minProLaboreForAnexoIII * 1.5);
  const changed = simProLabore !== snapshot.taxProfile.proLabore;
  const peak = Math.max(1, ...history.map((h) => h.das + h.inss));
  const avg = history.reduce((a, h) => a + h.das + h.inss, 0) / history.length;

  return (
    <div className="mx-auto max-w-5xl">
      <PageTitle eyebrow={`Simples Nacional · ${monthName(snapshot.month)}`} title="Impostos" />

      <Link
        to="/calendar"
        className="surface mb-5 flex items-center gap-3 p-4 transition-colors hover:bg-muted/40"
        aria-label="Abrir calendário fiscal"
      >
        <CalendarDays className="h-5 w-5 shrink-0 text-[hsl(var(--g-impostos))]" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Calendário fiscal</p>
          <p className="text-xs text-muted-foreground">DAS, DEFIS e IRPF com os próximos vencimentos.</p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
        {/* Quanto separar: o faturamento "fatiado" */}
        <section className="surface p-5 md:p-6 animate-rise">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Separe este mês</p>
              <Money value={actual.totalReserve} className="mt-1 block text-[2.6rem] font-semibold leading-none" />
              <p className="mt-2 text-sm text-muted-foreground">
                de <Money value={revenue} className="font-semibold text-foreground" /> faturados · DAS vence dia 20
              </p>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-2.5 py-1 text-xs font-bold",
                actual.anexo === "III" ? "bg-income/15 text-income" : "bg-danger/15 text-danger",
              )}
            >
              ANEXO {actual.anexo}
            </span>
          </div>

          <div className="mt-6 flex h-4 gap-[3px] overflow-hidden rounded-full" role="img" aria-label="Divisão do faturamento">
            {parts.map((p) =>
              p.value > 0 ? <div key={p.key} style={{ flexGrow: p.value, background: PART[p.key].color }} className="min-w-[4px] first:rounded-l-full last:rounded-r-full" /> : null,
            )}
          </div>

          <dl className="mt-5 space-y-3">
            {parts.map((p) => (
              <div key={p.key} className="flex items-center gap-3 text-sm">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PART[p.key].color }} />
                <dt className="flex-1 text-muted-foreground">
                  {p.key === "extra" ? `${PART.extra.label} (${formatPercent(snapshot.taxProfile.extraReserveRate, 0)})` : PART[p.key].label}
                </dt>
                <dd>
                  <Money value={p.value} className={cn("font-semibold", p.key === "free" && "text-income")} />
                </dd>
              </div>
            ))}
          </dl>

          <p className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">
            RBT12 {formatBRL(actual.rbt12)} · alíquota efetiva {formatPercent(actual.effectiveRate, 2)}
          </p>
        </section>

        {/* Fator R */}
        <section className="surface p-5 md:p-6 animate-rise [animation-delay:80ms]">
          <div className="flex items-center gap-5">
            <Ring
              value={actual.fatorR / FATOR_R_THRESHOLD}
              size={112}
              stroke={10}
              color={actual.fatorR >= FATOR_R_THRESHOLD ? "hsl(var(--income))" : "hsl(var(--warning))"}
            >
              <span className="text-center leading-tight">
                <span className="money block text-2xl font-semibold">{formatPercent(actual.fatorR)}</span>
                <span className="text-[10px] text-muted-foreground">meta {formatPercent(FATOR_R_THRESHOLD, 0)}</span>
              </span>
            </Ring>
            <div className="min-w-0">
              <h2 className="text-xl font-semibold">Fator R</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Folha ÷ faturamento de 12 meses. Com {formatPercent(FATOR_R_THRESHOLD, 0)} ou mais, TI paga pelo Anexo III, bem mais barato.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm">Simular pró-labore</span>
              <Money value={simProLabore} className="text-xl font-semibold" />
            </div>
            <Slider value={[simProLabore]} min={INSS_PARAMS.minimumWage} max={max} step={5_000} onValueChange={([v]) => setSimProLabore(v!)} aria-label="Pró-labore simulado" />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setSimProLabore(actual.minProLaboreForAnexoIII)}>
                Mínimo p/ Anexo III · {formatBRLCompact(actual.minProLaboreForAnexoIII)}
              </Button>
              {changed && (
                <Button size="sm" variant="ghost" onClick={() => setSimProLabore(snapshot.taxProfile.proLabore)}>
                  Voltar ao atual
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-muted p-3.5">
                <p className="text-xs text-muted-foreground">Hoje · Anexo {actual.anexo}</p>
                <Money value={totalActual} className="mt-1 block text-lg font-semibold" />
                <p className="text-[11px] text-muted-foreground">DAS + INSS</p>
              </div>
              <div className={cn("rounded-2xl p-3.5", diff > 0 ? "bg-income/12 ring-1 ring-income/30" : "bg-muted")}>
                <p className="text-xs text-muted-foreground">Simulado · Anexo {simulated.anexo}</p>
                <Money value={totalSim} className="mt-1 block text-lg font-semibold" />
                <p className={cn("text-[11px] font-semibold", diff > 0 ? "text-income" : diff < 0 ? "text-danger" : "text-muted-foreground")}>
                  {diff > 0 ? `economia de ${formatBRL(diff)}/mês` : diff < 0 ? `custa ${formatBRL(-diff)}/mês a mais` : "igual ao atual"}
                </p>
              </div>
            </div>

            {changed && (
              <Button
                className="w-full"
                disabled={save.isPending}
                onClick={async () => {
                  await save.mutateAsync({ ...snapshot.taxProfile, proLabore: simProLabore });
                  toast.success("Pró-labore atualizado");
                }}
              >
                Salvar como meu pró-labore
              </Button>
            )}
          </div>
        </section>
      </div>

      {/* Histórico: barras em HTML, sem biblioteca de gráfico */}
      <section className="mt-8 animate-rise [animation-delay:140ms]">
        <SectionTitle title="Últimos 12 meses" />
        <div className="surface p-5">
          <div className="flex items-baseline justify-between text-sm text-muted-foreground">
            <span>média mensal</span>
            <Money value={Math.round(avg)} className="text-lg font-semibold text-foreground" />
          </div>
          <div className="mt-5 flex h-40 items-end gap-1.5 sm:gap-2.5" role="img" aria-label="DAS e INSS por mês">
            {history.map((h) => {
              const total = h.das + h.inss;
              return (
                <div key={h.month} className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5" title={`${monthLabel(h.month)}: DAS ${formatBRL(h.das)} + INSS ${formatBRL(h.inss)}`}>
                  <div className="flex w-full max-w-[2.25rem] flex-col justify-end overflow-hidden rounded-[0.6rem]" style={{ height: `${(total / peak) * 100}%` }}>
                    <div style={{ flexGrow: h.inss, background: PART.inss.color }} className="min-h-[3px] opacity-90" />
                    <div style={{ flexGrow: h.das, background: PART.das.color }} className="mt-[2px] opacity-90 transition-opacity group-hover:opacity-100" />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex gap-1.5 sm:gap-2.5">
            {history.map((h, i) => (
              <span key={h.month} className="flex-1 text-center text-[10px] text-muted-foreground">
                {i % 2 === 0 || history.length <= 6 ? monthLabel(h.month).slice(0, 3) : ""}
              </span>
            ))}
          </div>
          <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: PART.das.color }} /> DAS
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: PART.inss.color }} /> INSS
            </span>
          </div>
        </div>
      </section>

      <p className="mt-6 px-1 text-xs leading-relaxed text-muted-foreground">
        Cálculo pelas tabelas da LC 123/2006 (redação da LC 155/2016) e parâmetros de INSS versionados em <code>packages/core</code>. É uma estimativa: confirme com seu contador.
      </p>
    </div>
  );
}
