import type { Category, ISODate, Transaction, TransactionKind } from "../types";
import { learnFromHistory, suggestCategory, type CategoryRule, type CategorySource } from "./categorize";
import type { StatementEntry } from "./parse";

/**
 * Transforma o extrato lido em uma prévia de importação: tipo, valor positivo,
 * categoria sugerida e marcação de duplicados. A UI só edita e confirma.
 */

export type DuplicateKind =
  /** Mesmo ID de importação já gravado: é o mesmo lançamento, com certeza. */
  | "imported"
  /** Mesma data, tipo e valor de um lançamento existente (provavelmente lançado à mão). */
  | "probable";

export interface ImportRow {
  /** Tag gravada no lançamento para reconhecê-lo em importações futuras. */
  importTag: string;
  date: ISODate;
  kind: TransactionKind;
  amount: number;
  description: string;
  categoryId: string;
  categorySource: CategorySource;
  duplicate?: DuplicateKind;
  /** Selecionada para importar. Duplicados começam desmarcados. */
  include: boolean;
}

export const IMPORT_TAG_PREFIX = "import:";

/** FNV-1a 32 bits: curto, estável e suficiente para identificar linhas de extrato. */
function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/**
 * ID estável de uma linha. Usa o ID do banco quando existe; senão, um hash do
 * conteúdo + a ordem de ocorrência (dois cafés iguais no mesmo dia são dois lançamentos).
 */
export function importTagsFor(entries: readonly StatementEntry[]): string[] {
  const seen = new Map<string, number>();
  return entries.map((e) => {
    if (e.externalId) return `${IMPORT_TAG_PREFIX}${hash(`id|${e.externalId}|${e.date}|${e.amount}`)}`;
    const base = `${e.date}|${e.amount}|${e.description.trim().toLowerCase()}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return `${IMPORT_TAG_PREFIX}${hash(`${base}|${n}`)}`;
  });
}

export interface ImportPlanInput {
  entries: readonly StatementEntry[];
  existing: readonly Transaction[];
  categories: readonly Category[];
  rules?: readonly CategoryRule[];
}

export function buildImportPlan({ entries, existing, categories, rules }: ImportPlanInput): ImportRow[] {
  const learned = learnFromHistory(existing);
  const importedTags = new Set(existing.flatMap((t) => t.tags ?? []).filter((tag) => tag.startsWith(IMPORT_TAG_PREFIX)));

  // Quantos lançamentos existentes há com a mesma data/tipo/valor. Cada um "absorve"
  // no máximo uma linha do extrato, para não marcar dois cafés por causa de um.
  const available = new Map<string, number>();
  const sig = (date: string, kind: string, amount: number) => `${date}|${kind}|${amount}`;
  for (const t of existing) {
    if (t.tags?.some((tag) => tag.startsWith(IMPORT_TAG_PREFIX))) continue;
    const k = sig(t.date, t.kind, t.amount);
    available.set(k, (available.get(k) ?? 0) + 1);
  }

  const tags = importTagsFor(entries);
  return entries.map((e, i) => {
    const kind: TransactionKind = e.amount >= 0 ? "income" : "expense";
    const amount = Math.abs(e.amount);
    const importTag = tags[i]!;
    const { categoryId, source } = suggestCategory(e.description, kind, { categories, learned, rules });

    let duplicate: DuplicateKind | undefined;
    if (importedTags.has(importTag)) duplicate = "imported";
    else {
      const k = sig(e.date, kind, amount);
      const n = available.get(k) ?? 0;
      if (n > 0) {
        duplicate = "probable";
        available.set(k, n - 1);
      }
    }

    return {
      importTag,
      date: e.date,
      kind,
      amount,
      description: e.description,
      categoryId,
      categorySource: source,
      ...(duplicate ? { duplicate } : {}),
      include: !duplicate,
    };
  });
}

/** Categorias de receita que contam como faturamento da PJ (RBT12 / DAS). */
export const BUSINESS_REVENUE_CATEGORIES: readonly string[] = ["nf-servicos", "freelance"];

export function rowToTransaction(row: ImportRow, accountId: string, today: ISODate): Omit<Transaction, "id"> {
  return {
    accountId,
    categoryId: row.categoryId,
    kind: row.kind,
    amount: row.amount,
    description: row.description,
    date: row.date,
    status: row.date <= today ? "paid" : "pending",
    recurrence: "none",
    isBusinessRevenue: row.kind === "income" && BUSINESS_REVENUE_CATEGORIES.includes(row.categoryId),
    tags: [row.importTag],
  };
}
