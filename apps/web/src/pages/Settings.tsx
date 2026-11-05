import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Download, LogOut, RotateCcw } from "lucide-react";
import { formatBRL } from "@chrise/core";
import { MockRepository } from "@chrise/data";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/Layout";
import { useSaveTaxProfile, useTaxProfile } from "@/hooks/use-finance";
import { DATA_SOURCE, IS_DEMO, repository } from "@/lib/repository";
import { getSupabase } from "@/lib/supabase";
import { toast } from "sonner";

export default function Settings() {
  const qc = useQueryClient();
  const { data: profile } = useTaxProfile();
  const save = useSaveTaxProfile();
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

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Ajustes" />

      <Card className="p-4 md:p-6 space-y-4">
        <h2 className="font-semibold">Perfil fiscal</h2>
        <p className="text-sm text-muted-foreground">
          Simples Nacional · TI com Fator R · pró-labore atual {profile ? formatBRL(profile.proLabore) : "…"} (ajuste na aba Impostos).
        </p>
        <form
          className="flex items-end gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!profile) return;
            const pct = Math.min(30, Math.max(0, Number(reserve) || 0));
            await save.mutateAsync({ ...profile, extraReserveRate: pct / 100 });
            toast.success("Reserva atualizada");
          }}
        >
          <div className="space-y-1.5 flex-1">
            <Label htmlFor="reserve">Reserva extra sobre o faturamento (%)</Label>
            <Input id="reserve" type="number" min={0} max={30} value={reserve} onChange={(e) => setReserve(e.target.value)} />
          </div>
          <Button type="submit" disabled={save.isPending}>Salvar</Button>
        </form>
      </Card>

      <Card className="p-4 md:p-6 space-y-3">
        <h2 className="font-semibold">Dados</h2>
        <p className="text-sm text-muted-foreground">
          Fonte: <code>{DATA_SOURCE}</code>
          {IS_DEMO && ". Dados fictícios gerados no navegador; suas edições ficam só neste dispositivo."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" onClick={exportData}>
            <Download className="w-4 h-4" /> Exportar backup (JSON)
          </Button>
          {IS_DEMO && repository instanceof MockRepository && (
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                (repository as MockRepository).reset();
                qc.invalidateQueries();
                toast.success("Demo restaurada");
              }}
            >
              <RotateCcw className="w-4 h-4" /> Restaurar demo
            </Button>
          )}
          {!IS_DEMO && (
            <Button variant="outline" className="gap-2" onClick={async () => (await getSupabase()).auth.signOut()}>
              <LogOut className="w-4 h-4" /> Sair
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
