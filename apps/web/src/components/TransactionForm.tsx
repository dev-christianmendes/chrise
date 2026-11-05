import { useState } from "react";
import { toCents, type TransactionKind } from "@chrise/core";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useAccounts, useCategories, useCreateTransaction } from "@/hooks/use-finance";

const today = () => new Date().toISOString().slice(0, 10);

/** Aceita "1.234,56", "1234,56" e "1234.56". */
function parseBRL(input: string): number {
  const s = input.trim().replace(/\s|R\$/g, "");
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  return Number(normalized);
}

export function TransactionForm({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data: categories = [] } = useCategories();
  const { data: accounts = [] } = useAccounts();
  const create = useCreateTransaction();

  const [kind, setKind] = useState<TransactionKind>("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState(today);
  const [monthly, setMonthly] = useState(false);

  const options = categories.filter((c) => c.kind === kind);
  const value = parseBRL(amount);
  const valid = Number.isFinite(value) && value > 0 && categoryId && (accountId || accounts[0]);

  const reset = () => {
    setAmount("");
    setDescription("");
    setCategoryId("");
    setMonthly(false);
    setDate(today());
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    const category = categories.find((c) => c.id === categoryId);
    await create.mutateAsync({
      kind,
      amount: toCents(value),
      description: description.trim() || category?.name || "",
      categoryId,
      accountId: accountId || accounts[0]!.id,
      date,
      status: date <= today() ? "paid" : "pending",
      recurrence: monthly ? "monthly" : "none",
      isBusinessRevenue: kind === "income" && (categoryId === "nf-servicos" || categoryId === "freelance"),
    });
    toast.success("Lançamento salvo");
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo lançamento</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Tabs
            value={kind}
            onValueChange={(v) => {
              setKind(v as TransactionKind);
              setCategoryId("");
            }}
          >
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="expense">Despesa</TabsTrigger>
              <TabsTrigger value="income">Receita</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="space-y-2">
            <Label htmlFor="amount">Valor (R$)</Label>
            <Input id="amount" inputMode="decimal" placeholder="0,00" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} className="text-lg tabular-nums" />
          </div>

          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha" />
              </SelectTrigger>
              <SelectContent>
                {options.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Input id="description" placeholder="Opcional" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="date">Data</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Conta</Label>
              <Select value={accountId || accounts[0]?.id} onValueChange={setAccountId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <label className="flex items-center justify-between rounded-lg border border-border p-3">
            <span className="text-sm">Repete todo mês</span>
            <Switch checked={monthly} onCheckedChange={setMonthly} />
          </label>

          <Button type="submit" className="w-full" disabled={!valid || create.isPending}>
            {create.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
