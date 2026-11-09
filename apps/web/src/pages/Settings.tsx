import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, ChevronRight, Database, Download, FileUp, Landmark, LogOut, Moon, Percent, RotateCcw, Target } from "lucide-react";
import { formatBRL } from "@chrise/core";
import { MockRepository } from "@chrise/data";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PageTitle } from "@/components/kit";
import { useSaveTaxProfile, useTaxProfile } from "@/hooks/use-finance";
import { useSheetParam, useTheme } from "@/hooks/use-ui";
import { DATA_SOURCE, IS_DEMO, repository } from "@/lib/repository";
import { getSupabase } from "@/lib/supabase";
import { disablePush, enablePush, getPushSubscription, isPushSupported, schedulePushReminders } from "@/lib/push";
import { useSnapshot } from "@/hooks/use-finance";
import { buildPushReminders } from "@chrise/core";

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="eyebrow mb-2 px-1">{title}</h2>
      <div className="surface divide-y divide-border overflow-hidden">{children}</div>
    </section>
  );
}

function Row({ icon: Icon, title, hint, children }: { icon: typeof Moon; title: string; hint?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex min-h-[3.75rem] items-center gap-3 px-4 py-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
        <Icon className="h-[1.1rem] w-[1.1rem]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.95rem] font-medium">{title}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
      {children}
    </div>
  );
}

const rowLink = "flex min-h-[3.75rem] items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40";

function PushSettings() {
  const { snapshot } = useSnapshot();
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    getPushSubscription().then((subscription) => {
      setEnabled(Boolean(subscription));
      setBusy(false);
    }).catch(() => setBusy(false));
  }, []);

  if (!isPushSupported()) return null;

  const toggle = async () => {
    setBusy(true);
    try {
      if (enabled) {
        await disablePush();
        setEnabled(false);
        toast.success("Avisos desativados");
      } else {
        await enablePush();
        if (snapshot) await schedulePushReminders(buildPushReminders({ today: new Date().toISOString().slice(0, 10), snapshot }));
        setEnabled(true);
        toast.success("Avisos ativados");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível configurar os avisos");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Group title="Avisos">
      <Row icon={Bell} title="Lembretes financeiros" hint="DAS e orçamento perto do limite.">
        <Button variant="outline" size="sm" onClick={toggle} disabled={busy}>
          {busy ? "…" : enabled ? "Desativar" : "Ativar"}
        </Button>
      </Row>
    </Group>
  );
}

export default function Settings() {
  const qc = useQueryClient();
  const { data: profile } = useTaxProfile();
  const save = useSaveTaxProfile();
  const [theme, toggleTheme] = useTheme();
  const [, setImportOpen] = useSheetParam("import");
  const [reserve, setReserve] = useState("");

  useEffect(() => {
    if (profile) setReserve(String(Math.round(profile.extraReserveRate * 100)));
  }, [profile]);

  const exportData = async () => {
    const [transactions, budgets, accounts, taxProfile] = await Promise.all([
      repository.listTransactions(),
      repository.listBudgets(),
      repository.listAccounts(),
      repository.getTaxProfile(),
    ]);
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), accounts, transactions, budgets, taxProfile }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `chrise-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const saveReserve = async () => {
    if (!profile) return;
    const pct = Math.min(30, Math.max(0, Number(reserve) || 0));
    if (pct / 100 === profile.extraReserveRate) return;
    await save.mutateAsync({ ...profile, extraReserveRate: pct / 100 });
    toast.success("Reserva atualizada");
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle eyebrow="Preferências" title="Ajustes" />

      <div className="space-y-7">
        {!IS_DEMO && <PushSettings />}
        <Group title="Aparência">
          <Row icon={Moon} title="Tema escuro" hint="O cofre fica escuro nos dois temas.">
            <Switch checked={theme === "dark"} onCheckedChange={toggleTheme} aria-label="Tema escuro" />
          </Row>
        </Group>

        <Group title="Impostos PJ">
          <Link to="/taxes" className={rowLink}>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
              <Landmark className="h-[1.1rem] w-[1.1rem]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.95rem] font-medium">Pró-labore</span>
              <span className="block text-xs text-muted-foreground">
                {profile ? formatBRL(profile.proLabore) : "…"} · simule em Impostos
              </span>
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
          <Row icon={Percent} title="Reserva extra" hint="Sobre o faturamento: contador, imprevistos.">
            <span className="flex items-center gap-1 rounded-full bg-muted px-3 py-1.5">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={30}
                aria-label="Reserva extra em porcentagem"
                value={reserve}
                onChange={(e) => setReserve(e.target.value)}
                onBlur={saveReserve}
                onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
                className="money w-8 bg-transparent text-right font-semibold outline-none"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </span>
          </Row>
          <Link to="/budgets" className={rowLink}>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
              <Target className="h-[1.1rem] w-[1.1rem]" />
            </span>
            <span className="min-w-0 flex-1 text-[0.95rem] font-medium">Limites por categoria</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </Group>

        <Group title="Dados">
          <Row
            icon={Database}
            title="Fonte dos dados"
            hint={IS_DEMO ? "Demonstração: dados fictícios, suas edições ficam só neste aparelho." : "Sua conta, protegida por RLS no banco."}
          >
            <code className="rounded-full bg-muted px-2.5 py-1 text-xs">{DATA_SOURCE}</code>
          </Row>
          <button type="button" onClick={() => setImportOpen(true)} className={`${rowLink} w-full text-left`}>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
              <FileUp className="h-[1.1rem] w-[1.1rem]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.95rem] font-medium">Importar extrato</span>
              <span className="block text-xs text-muted-foreground">OFX ou CSV do banco</span>
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
          <button type="button" onClick={exportData} className={`${rowLink} w-full text-left`}>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
              <Download className="h-[1.1rem] w-[1.1rem]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.95rem] font-medium">Exportar backup</span>
              <span className="block text-xs text-muted-foreground">Arquivo JSON com tudo</span>
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </Group>

        {IS_DEMO && repository instanceof MockRepository && (
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => {
              (repository as MockRepository).reset();
              qc.invalidateQueries();
              toast.success("Demo restaurada");
            }}
          >
            <RotateCcw className="h-4 w-4" /> Restaurar demo
          </Button>
        )}
        {!IS_DEMO && (
          <Button variant="outline" className="w-full gap-2 text-danger hover:text-danger" onClick={async () => (await getSupabase()).auth.signOut()}>
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        )}
      </div>
    </div>
  );
}
