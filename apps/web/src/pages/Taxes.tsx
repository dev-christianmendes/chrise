import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  addMonths,
  businessRevenueByMonth,
  calculateSimples,
  FATOR_R_THRESHOLD,
  formatBRL,
  formatBRLCompact,
  formatPercent,
  lastMonths,
  monthLabel,
  simplesForMonth,
  toCents,
} from "@chrise/core";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { PageHeader } from "@/components/Layout";
import { ErrorState, PageSkeleton } from "@/components/states";
import { useSaveTaxProfile, useSnapshot } from "@/hooks/use-finance";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: string }) {
  return (
    <div className="flex justify-between py-1.5 text-sm">
      <span className={cn("text-muted-foreground", strong && "text-foreground font-medium")}>{label}</span>
      <span className={cn("tabular-nums", strong && "font-semibold", tone)}>{value}</span>
    </div>
  );
}

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

    // Histórico do DAS estimado nos últimos 12 meses fechados
    const months = lastMonths(addMonths(snapshot.month, -1), 12);
    const all = businessRevenueByMonth(snapshot.transactions, lastMonths(addMonths(snapshot.month, -1), 24));
    const history = months.map((m, i) => {
      const r = calculateSimples({
        monthRevenue: all[12 + i]!,
        previousRevenues: all.slice(i, 12 + i).filter((v) => v > 0),
        proLabore: snapshot.taxProfile.proLabore,
      });
      return { label: monthLabel(m), das: r.das, inss: r.inss, anexo: r.anexo };
    });
    return { actual, simulated, history };
  }, [snapshot, simProLabore]);

  if (error) return <ErrorState error={error} />;
  if (isLoading || !model || !snapshot || simProLabore === null) return <PageSkeleton />;

  const { actual, simulated, history } = model;
  const totalActual = actual.das + actual.inss;
  const totalSim = simulated.das + simulated.inss;
  const diff = totalActual - totalSim;
  const max = Math.max(toCents(15_000), actual.minProLaboreForAnexoIII * 1.5);
  const changed = simProLabore !== snapshot.taxProfile.proLabore;

  return (
    <div className="space-y-6">
      <PageHeader title="Impostos PJ" subtitle={`Simples Nacional · apuração de ${monthLabel(snapshot.month)}`} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Quanto separar este mês</h2>
            <span className={cn("rounded-md px-2 py-1 text-xs font-semibold", actual.anexo === "III" ? "bg-success/10 text-success" : "bg-danger/10 text-danger")}>
              Anexo {actual.anexo}
            </span>
          </div>
          <Row label="Faturamento do mês" value={formatBRL(actual.netAfterTaxes + actual.totalReserve)} />
          <Row label="RBT12 (12 meses anteriores)" value={formatBRL(actual.rbt12)} />
          <Row label="Alíquota efetiva" value={formatPercent(actual.effectiveRate, 2)} />
          <div className="my-2 border-t border-border" />
          <Row label="DAS (vence dia 20)" value={formatBRL(actual.das)} tone="text-danger" />
          <Row label="INSS sobre pró-labore" value={formatBRL(actual.inss)} tone="text-danger" />
          <Row label={`Reserva extra (${formatPercent(snapshot.taxProfile.extraReserveRate, 0)})`} value={formatBRL(actual.extraReserve)} />
          <div className="my-2 border-t border-border" />
          <Row label="Total a separar" value={formatBRL(actual.totalReserve)} strong tone="text-danger" />
          <Row label="Livre para a pessoa física" value={formatBRL(actual.netAfterTaxes)} strong tone="text-success" />
        </Card>

        <Card className="p-4 md:p-6">
          <h2 className="font-semibold mb-1">Fator R</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Folha ÷ faturamento dos últimos 12 meses. A partir de {formatPercent(FATOR_R_THRESHOLD, 0)} a PJ de TI paga pelo Anexo III, bem mais barato que o V.
          </p>
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-3xl font-bold tabular-nums">{formatPercent(actual.fatorR)}</span>
            <span className="text-xs text-muted-foreground">meta {formatPercent(FATOR_R_THRESHOLD, 0)}</span>
          </div>
          <Progress value={Math.min(100, (actual.fatorR / FATOR_R_THRESHOLD) * 100)} />

          <div className="mt-6 space-y-3">
            <div className="flex justify-between text-sm">
              <span>Simular pró-labore</span>
              <span className="font-semibold tabular-nums">{formatBRL(simProLabore)}</span>
            </div>
            <Slider value={[simProLabore]} min={toCents(1_518)} max={max} step={5_000} onValueChange={([v]) => setSimProLabore(v!)} aria-label="Pró-labore simulado" />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setSimProLabore(actual.minProLaboreForAnexoIII)}>
                Mínimo p/ Anexo III ({formatBRLCompact(actual.minProLaboreForAnexoIII)})
              </Button>
              {changed && (
                <Button
                  size="sm"
                  onClick={async () => {
                    await save.mutateAsync({ ...snapshot.taxProfile, proLabore: simProLabore });
                    toast.success("Pró-labore atualizado");
                  }}
                >
                  Salvar como meu pró-labore
                </Button>
              )}
            </div>
            <div className="rounded-lg bg-muted p-3 text-sm">
              Com esse pró-labore: <strong>Anexo {simulated.anexo}</strong>, DAS {formatBRL(simulated.das)} + INSS {formatBRL(simulated.inss)} ={" "}
              <strong>{formatBRL(totalSim)}</strong>.{" "}
              {diff > 0 ? (
                <span className="text-success">Economia de {formatBRL(diff)}/mês.</span>
              ) : diff < 0 ? (
                <span className="text-danger">Custa {formatBRL(-diff)}/mês a mais.</span>
              ) : null}
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-4 md:p-6">
        <h2 className="font-semibold mb-4">DAS + INSS estimados (12 meses)</h2>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={history} margin={{ left: 0, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} tickFormatter={(v) => formatBRLCompact(v)} width={84} />
            <Tooltip
              contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)" }}
              formatter={(v: number) => formatBRL(v)}
            />
            <Bar dataKey="das" name="DAS" stackId="t" fill="hsl(var(--danger))" />
            <Bar dataKey="inss" name="INSS" stackId="t" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <p className="text-xs text-muted-foreground">
        Cálculo pelas tabelas da LC 123/2006 (redação da LC 155/2016) e parâmetros de INSS versionados em <code>packages/core</code>. É uma estimativa: confirme com seu contador.
      </p>
    </div>
  );
}
