import type { Category, Transaction, TransactionKind } from "../types";

/**
 * Categorização de lançamentos importados, em duas camadas:
 *
 * 1. **Histórico do usuário**: se você já classificou "PIX ENVIADO JOAO SILVA"
 *    como Aluguel, o próximo igual vai para Aluguel. Isso é a "regra" que aprende.
 * 2. **Regras padrão por palavra-chave** (iFood → Delivery, Drogasil → Farmácia…).
 *
 * Sem nenhuma das duas, cai em uma categoria neutra e a UI destaca a linha.
 */

export type CategorySource = "history" | "rule" | "fallback" | "manual";

/**
 * Normaliza a descrição para comparar lançamentos: sem acento, minúsculas,
 * sem números (datas, parcelas, códigos de autorização) e sem pontuação.
 */
export function normalizeDescription(description: string): string {
  return description
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\d+/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface CategoryRule {
  categoryId: string;
  /** Palavras ou expressões (já normalizadas), casadas como palavra inteira. */
  keywords: string[];
}

/** A ordem importa: a primeira regra que casa vence ("uber eats" antes de "uber"). */
export const DEFAULT_CATEGORY_RULES: readonly CategoryRule[] = [
  { categoryId: "delivery", keywords: ["ifood", "ifd", "rappi", "uber eats", "ubereats", "ze delivery", "aiqfome", "james delivery"] },
  { categoryId: "das", keywords: ["das simples", "das mei", "das sn", "simples nacional", "pgdas", "documento de arrecadacao"] },
  { categoryId: "inss", keywords: ["inss", "gps", "previdencia social"] },
  { categoryId: "contador", keywords: ["contabil", "contabilidade", "contador", "contabilizei", "agilize"] },
  { categoryId: "aluguel", keywords: ["aluguel", "quintoandar", "quinto andar", "imobiliaria"] },
  { categoryId: "condominio", keywords: ["condominio", "cond"] },
  {
    categoryId: "energia",
    keywords: ["enel", "light", "cemig", "copel", "celesc", "cpfl", "coelba", "neoenergia", "equatorial", "energisa", "eletropaulo", "energia", "conta de luz"],
  },
  { categoryId: "internet", keywords: ["vivo", "claro", "tim", "oi", "net servicos", "internet", "telefonica", "fibra", "algar"] },
  { categoryId: "plano-saude", keywords: ["unimed", "amil", "sulamerica", "bradesco saude", "hapvida", "notredame", "porto saude", "plano de saude"] },
  { categoryId: "farmacia", keywords: ["drogasil", "droga raia", "raia", "drogaria", "farmacia", "pague menos", "panvel", "drogao"] },
  { categoryId: "academia", keywords: ["smart fit", "smartfit", "academia", "gympass", "wellhub", "totalpass", "bluefit"] },
  { categoryId: "pet-veterinario", keywords: ["veterinari", "veterinaria", "veterinario", "clinica vet", "hospital vet", "vet"] },
  { categoryId: "pet-banho", keywords: ["banho e tosa", "tosa"] },
  { categoryId: "pet-racao", keywords: ["petz", "cobasi", "petlove", "pet shop", "petshop", "racao", "agropet"] },
  {
    categoryId: "assinaturas",
    keywords: [
      "netflix", "spotify", "disney", "hbo", "max", "prime video", "amazon prime", "youtube", "google one",
      "icloud", "apple com bill", "apple", "deezer", "globoplay", "paramount", "crunchyroll", "chatgpt", "openai",
      "anthropic", "claude ai", "github", "notion", "adobe", "microsoft", "canva",
    ],
  },
  { categoryId: "cursos", keywords: ["udemy", "alura", "rocketseat", "coursera", "livraria", "amazon kindle", "kindle", "hotmart"] },
  {
    categoryId: "mercado",
    keywords: [
      "mercado", "supermercado", "supermercados", "carrefour", "pao de acucar", "assai", "atacadao", "extra",
      "hortifruti", "sams club", "makro", "zaffari", "guanabara", "bh supermercados", "sonda", "atacarejo",
    ],
  },
  {
    categoryId: "transporte",
    keywords: [
      "uber", "pop", "cabify", "indriver", "posto", "shell", "ipiranga", "petrobras", "br mania", "combustivel",
      "estacionamento", "estapar", "sem parar", "conectcar", "veloe", "metro", "bilhete unico", "pedagio", "zul",
    ],
  },
  {
    categoryId: "restaurante",
    keywords: [
      "restaurante", "lanchonete", "padaria", "pizzaria", "hamburgueria", "burger", "bk", "mcdonalds", "mc donalds",
      "outback", "starbucks", "cafe", "cafeteria", "bar", "churrascaria", "sushi", "subway", "habibs", "spoleto",
    ],
  },
  { categoryId: "lazer", keywords: ["cinema", "cinemark", "ingresso", "ingressos", "sympla", "steam", "playstation", "xbox", "nintendo", "show", "teatro"] },
  { categoryId: "rendimentos", keywords: ["rendimento", "rendimentos", "rend pago", "juros", "cdb", "dividendos", "remuneracao aplicacao"] },
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const compiled = new WeakMap<CategoryRule, RegExp>();
function ruleRegex(rule: CategoryRule): RegExp {
  let re = compiled.get(rule);
  if (!re) {
    re = new RegExp(`(?:^| )(?:${rule.keywords.map(escape).join("|")})(?: |$)`);
    compiled.set(rule, re);
  }
  return re;
}

/** Índice "descrição normalizada + tipo → categoria mais usada", aprendido do histórico. */
export type LearnedRules = Map<string, string>;

const historyKey = (kind: TransactionKind, normalized: string) => `${kind}:${normalized}`;

export function learnFromHistory(transactions: readonly Transaction[]): LearnedRules {
  const counts = new Map<string, Map<string, { n: number; last: string }>>();
  for (const t of transactions) {
    const normalized = normalizeDescription(t.description);
    if (!normalized) continue;
    const key = historyKey(t.kind, normalized);
    const byCategory = counts.get(key) ?? new Map();
    const c = byCategory.get(t.categoryId) ?? { n: 0, last: "" };
    byCategory.set(t.categoryId, { n: c.n + 1, last: t.date > c.last ? t.date : c.last });
    counts.set(key, byCategory);
  }
  const learned: LearnedRules = new Map();
  for (const [key, byCategory] of counts) {
    // Mais frequente; empate → a mais recente (o usuário pode ter mudado de ideia).
    const [best] = [...byCategory.entries()].sort((a, b) => b[1].n - a[1].n || (a[1].last < b[1].last ? 1 : -1));
    learned.set(key, best![0]);
  }
  return learned;
}

export interface CategorizeContext {
  categories: readonly Category[];
  learned: LearnedRules;
  rules?: readonly CategoryRule[];
}

export interface CategorySuggestion {
  categoryId: string;
  source: CategorySource;
}

/** Categoria neutra quando nada casa. Receita sem regra NÃO vira faturamento PJ (afetaria o DAS). */
export const FALLBACK_CATEGORY: Record<TransactionKind, string> = { expense: "outros", income: "rendimentos" };

export function suggestCategory(description: string, kind: TransactionKind, ctx: CategorizeContext): CategorySuggestion {
  const byId = new Map(ctx.categories.map((c) => [c.id, c]));
  const fits = (id: string | undefined): id is string => !!id && byId.get(id)?.kind === kind;
  const normalized = normalizeDescription(description);

  const fromHistory = ctx.learned.get(historyKey(kind, normalized));
  if (fits(fromHistory)) return { categoryId: fromHistory, source: "history" };

  for (const rule of ctx.rules ?? DEFAULT_CATEGORY_RULES) {
    if (fits(rule.categoryId) && ruleRegex(rule).test(normalized)) return { categoryId: rule.categoryId, source: "rule" };
  }

  const fallback = FALLBACK_CATEGORY[kind];
  const categoryId = fits(fallback) ? fallback : (ctx.categories.find((c) => c.kind === kind)?.id ?? fallback);
  return { categoryId, source: "fallback" };
}
