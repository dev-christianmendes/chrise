import { useMemo, useRef, useState } from "react";
import { FileUp, Sparkles, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import {
  buildImportPlan,
  decodeStatement,
  formatBRL,
  normalizeDescription,
  parseStatement,
  rowToTransaction,
  type ImportRow,
  type ParsedStatement,
} from "@chrise/core";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAccounts, useCategories, useImportTransactions, useTransactions } from "@/hooks/use-finance";
import { cn } from "@/lib/utils";

const today = () => new Date().toISOString().slice(0, 10);
const formatDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });

interface Loaded {
  fileName: string;
  parsed: ParsedStatement;
}

export function ImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data: categories } = useCategories();
  const { data: accounts = [] } = useAccounts();
  const { data: existing } = useTransactions();
  // A prévia depende do histórico (categorias aprendidas, duplicados): só lê o arquivo com tudo carregado.
  const ready = !!categories && !!existing && accounts.length > 0;
  const importMutation = useImportTransactions();
  const fileInput = useRef<HTMLInputElement>(null);

  const [accountId, setAccountId] = useState("");
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [invert, setInvert] = useState(false);
  /** Edições do usuário por linha (importTag); a prévia em si é derivada dos dados. */
  const [overrides, setOverrides] = useState<Record<string, Partial<Pick<ImportRow, "categoryId" | "include">>>>({});
  const [error, setError] = useState<string | null>(null);

  const account = accountId || accounts[0]?.id || "";

  const plan = useMemo(() => {
    if (!loaded || !categories || !existing) return [];
    const entries = invert ? loaded.parsed.entries.map((e) => ({ ...e, amount: -e.amount })) : loaded.parsed.entries;
    return buildImportPlan({ entries, existing, categories });
  }, [loaded, invert, existing, categories]);

  const rows = useMemo(
    () =>
      plan.map((r): ImportRow => {
        const o = overrides[r.importTag];
        if (!o) return r;
        return { ...r, ...o, ...(o.categoryId ? { categorySource: "manual" as const } : {}) };
      }),
    [plan, overrides],
  );

  const override = (tags: string[], patch: Partial<Pick<ImportRow, "categoryId" | "include">>) =>
    setOverrides((prev) => {
      const next = { ...prev };
      for (const tag of tags) next[tag] = { ...next[tag], ...patch };
      return next;
    });

  const reset = () => {
    setLoaded(null);
    setOverrides({});
    setError(null);
    setInvert(false);
    if (fileInput.current) fileInput.current.value = "";
  };

  const close = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const parsed = parseStatement(decodeStatement(await file.arrayBuffer()));
      if (parsed.entries.length === 0) throw new Error("Nenhum lançamento encontrado no arquivo.");
      setLoaded({ fileName: file.name, parsed });
      setOverrides({});
      setInvert(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não consegui ler o arquivo.");
      setLoaded(null);
    }
  };

  /** Mudar a categoria de uma linha aplica o mesmo às linhas com a mesma descrição que ainda não foram editadas. */
  const setCategory = (target: ImportRow, categoryId: string) => {
    const key = normalizeDescription(target.description);
    const same = rows.filter(
      (r) => r === target || (r.kind === target.kind && r.categorySource !== "manual" && normalizeDescription(r.description) === key),
    );
    override(same.map((r) => r.importTag), { categoryId });
  };

  const toggle = (row: ImportRow) => override([row.importTag], { include: !row.include });
  const toggleAll = (include: boolean) => override(rows.map((r) => r.importTag), { include });

  const stats = useMemo(() => {
    const selected = rows.filter((r) => r.include);
    return {
      selected: selected.length,
      duplicates: rows.filter((r) => r.duplicate).length,
      uncategorized: selected.filter((r) => r.categorySource === "fallback").length,
      income: selected.filter((r) => r.kind === "income").reduce((a, r) => a + r.amount, 0),
      expense: selected.filter((r) => r.kind === "expense").reduce((a, r) => a + r.amount, 0),
    };
  }, [rows]);

  const submit = async () => {
    const day = today();
    const inputs = rows.filter((r) => r.include).map((r) => rowToTransaction(r, account, day));
    await importMutation.mutateAsync(inputs);
    toast.success(`${inputs.length} lançamento${inputs.length === 1 ? "" : "s"} importado${inputs.length === 1 ? "" : "s"}`);
    close(false);
  };

  const options = (kind: ImportRow["kind"]) => (categories ?? []).filter((c) => c.kind === kind);

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-3xl max-h-[92dvh] flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle>Importar extrato</DialogTitle>
          <DialogDescription>
            OFX ou CSV do seu banco. O arquivo é lido no próprio dispositivo; nada é enviado antes de você confirmar.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Conta</Label>
            <Select value={account} onValueChange={setAccountId}>
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
          <div className="space-y-2">
            <Label htmlFor="statement-file">Arquivo</Label>
            <input
              ref={fileInput}
              id="statement-file"
              type="file"
              accept=".ofx,.qfx,.csv,.txt,text/csv,application/x-ofx"
              className="sr-only"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            <Button
              type="button"
              variant="outline"
              disabled={!ready}
              className="w-full justify-start gap-2 font-normal"
              onClick={() => fileInput.current?.click()}
            >
              <FileUp className="w-4 h-4 shrink-0" />
              <span className="truncate">{!ready ? "Carregando…" : (loaded?.fileName ?? "Escolher OFX ou CSV")}</span>
            </Button>
          </div>
        </div>

        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-lg bg-danger/10 p-3 text-sm text-danger">
            <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0" />
            {error}
          </p>
        )}

        {loaded && (
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <span>
                <strong className="tabular-nums">{stats.selected}</strong> de {rows.length} selecionados
              </span>
              {stats.duplicates > 0 && <span className="text-muted-foreground">{stats.duplicates} possíveis duplicados desmarcados</span>}
              {loaded.parsed.skipped > 0 && <span className="text-muted-foreground">{loaded.parsed.skipped} linhas ignoradas (saldo/inválidas)</span>}
              <div className="ml-auto flex gap-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => toggleAll(true)}>
                  Marcar todos
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => toggleAll(false)}>
                  Nenhum
                </Button>
              </div>
            </div>

            <label className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
              <span className="text-sm">
                Inverter sinais
                <span className="block text-xs text-muted-foreground">
                  {loaded.parsed.invertedSigns
                    ? "Detectei uma fatura de cartão e já tratei valores positivos como gastos."
                    : "Use se as compras apareceram como receitas (comum em fatura de cartão)."}
                </span>
              </span>
              <Switch
                checked={invert}
                onCheckedChange={(v) => {
                  setInvert(v);
                  setOverrides({});
                }}
              />
            </label>

            <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border divide-y divide-border">
              {rows.map((r) => (
                <div key={r.importTag} className={cn("flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center", !r.include && "opacity-50")}>
                  <label className="flex min-w-0 flex-1 items-center gap-3">
                    <input type="checkbox" checked={r.include} onChange={() => toggle(r)} className="h-4 w-4 shrink-0 accent-primary" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium" title={r.description}>
                        {r.description}
                      </span>
                      <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        {formatDate(r.date)}
                        {r.duplicate === "imported" && <span className="rounded bg-muted px-1.5">já importado</span>}
                        {r.duplicate === "probable" && <span className="rounded bg-warning/10 px-1.5 text-warning">parece já lançado</span>}
                        {r.categorySource === "history" && (
                          <span className="inline-flex items-center gap-0.5 text-primary">
                            <Sparkles className="w-3 h-3" /> pelo histórico
                          </span>
                        )}
                      </span>
                    </span>
                    <span className={cn("text-sm font-semibold tabular-nums", r.kind === "income" ? "text-success" : "text-danger")}>
                      {r.kind === "income" ? "+" : "−"}
                      {formatBRL(r.amount)}
                    </span>
                  </label>
                  <select
                    aria-label={`Categoria de ${r.description}`}
                    value={r.categoryId}
                    onChange={(e) => setCategory(r, e.target.value)}
                    className={cn(
                      "h-9 rounded-md border bg-background px-2 text-sm sm:w-48 ml-7 sm:ml-0",
                      r.categorySource === "fallback" && r.include ? "border-warning" : "border-input",
                    )}
                  >
                    {options(r.kind).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                <span className="text-success tabular-nums">+{formatBRL(stats.income)}</span> ·{" "}
                <span className="text-danger tabular-nums">−{formatBRL(stats.expense)}</span>
                {stats.uncategorized > 0 && <> · {stats.uncategorized} sem categoria reconhecida (borda amarela)</>}
              </p>
              <Button onClick={submit} disabled={stats.selected === 0 || !account || importMutation.isPending}>
                {importMutation.isPending ? "Importando…" : `Importar ${stats.selected}`}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
