import {
  addMonths,
  calculateSimples,
  type Account,
  type Budget,
  type Cents,
  type ISODate,
  type TaxProfile,
  type Transaction,
  type YearMonth,
} from "@chrise/core";
import { createRandom } from "./random";

/**
 * Gera o histórico de um "dev PJ fictício que mora sozinho com dois pets".
 * Determinístico por mês: o mesmo mês sempre gera os mesmos lançamentos,
 * mesmo que a âncora (mês atual) avance.
 */

const R = (reais: number): Cents => Math.round(reais * 100);

export const MOCK_ACCOUNTS: Account[] = [
  { id: "acc-pj", name: "Conta PJ", type: "checking", openingBalance: R(4_000) },
  { id: "acc-pf", name: "Conta PF", type: "checking", openingBalance: R(2_500) },
  { id: "acc-card", name: "Cartão de crédito", type: "credit_card", openingBalance: 0 },
];

export const MOCK_TAX_PROFILE: TaxProfile = {
  regime: "simples",
  activity: "ti_fator_r",
  proLabore: R(4_200),
  extraReserveRate: 0.03,
};

export interface MockDataset {
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  taxProfile: TaxProfile;
}

export interface GenerateOptions {
  /** Último mês gerado (normalmente o mês atual). */
  endMonth: YearMonth;
  /** Último dia gerado dentro do mês final (lançamentos futuros ficam "pending"). */
  today: ISODate;
  months?: number;
}

const day = (ym: YearMonth, d: number): ISODate => `${ym}-${String(Math.min(d, 28)).padStart(2, "0")}`;

const monthSeed = (ym: YearMonth) => Number(ym.replace("-", "")) * 7919;

export function generateMockDataset({ endMonth, today, months = 24 }: GenerateOptions): MockDataset {
  const transactions: Transaction[] = [];
  const startMonth = addMonths(endMonth, -(months - 1));
  const revenues: Cents[] = [];
  let seq = 0;

  for (let i = 0; i < months; i++) {
    const ym = addMonths(startMonth, i);
    const rnd = createRandom(monthSeed(ym));
    const monthNum = Number(ym.slice(5));
    // Âncora absoluta no calendário (e não no início da janela) para o mês gerar sempre igual.
    const yearsSinceBase = Math.max(0, Number(ym.slice(0, 4)) - 2025);

    const push = (
      categoryId: string,
      amount: Cents,
      d: number,
      description: string,
      extra: Partial<Transaction> = {},
    ) => {
      const date = day(ym, d);
      transactions.push({
        id: `mock-${ym}-${++seq}`,
        accountId: "acc-pf",
        categoryId,
        kind: "expense",
        amount,
        description,
        date,
        status: date <= today ? "paid" : "pending",
        recurrence: "none",
        ...extra,
      });
    };

    // ---------- Receita PJ: reajuste anual de ~10% ----------
    const nf = R(13_500 * 1.1 ** yearsSinceBase);
    push("nf-servicos", nf, 5, "NF de serviços — cliente principal", {
      kind: "income",
      accountId: "acc-pj",
      recurrence: "monthly",
      isBusinessRevenue: true,
    });
    let monthRevenue = nf;
    if (rnd.chance(0.3)) {
      const fl = R(rnd.int(15, 45) * 100);
      monthRevenue += fl;
      push("freelance", fl, rnd.int(10, 25), "Projeto freelance", {
        kind: "income",
        accountId: "acc-pj",
        isBusinessRevenue: true,
      });
    }
    push("rendimentos", R(rnd.int(40, 120)), 28, "Rendimento da reserva", { kind: "income" });

    // ---------- Impostos (calculados pelo próprio core) ----------
    const simples = calculateSimples({
      monthRevenue,
      previousRevenues: revenues,
      proLabore: MOCK_TAX_PROFILE.proLabore,
    });
    revenues.push(monthRevenue);
    push("das", simples.das, 20, `DAS — Anexo ${simples.anexo}`, { accountId: "acc-pj", recurrence: "monthly" });
    push("inss", simples.inss, 15, "INSS sobre pró-labore", { accountId: "acc-pj", recurrence: "monthly" });
    push("contador", R(290), 10, "Honorários do contador", { accountId: "acc-pj", recurrence: "monthly" });

    // ---------- Moradia ----------
    push("aluguel", R(2_100 * 1.06 ** yearsSinceBase), 8, "Aluguel", { recurrence: "monthly" });
    push("condominio", R(480), 8, "Condomínio", { recurrence: "monthly" });
    const summer = [12, 1, 2, 3].includes(monthNum);
    push("energia", rnd.around(summer ? R(260) : R(160), 0.12), 12, "Conta de energia", { recurrence: "monthly" });
    push("internet", R(169.9), 15, "Internet fibra + celular", { recurrence: "monthly" });

    // ---------- Alimentação ----------
    for (const d of [3, 11, 19, 26]) push("mercado", rnd.around(R(230), 0.25), d, "Mercado");
    const deliveries = rnd.int(4, 9);
    for (let k = 0; k < deliveries; k++) {
      push("delivery", rnd.around(R(62), 0.35), rnd.int(1, 28), "Delivery", { accountId: "acc-card" });
    }
    if (rnd.chance(0.7)) push("restaurante", rnd.around(R(140), 0.4), rnd.int(1, 28), "Jantar fora", { accountId: "acc-card" });

    // ---------- Pets ----------
    push("pet-racao", rnd.around(R(260), 0.08), 4, "Ração premium (2 pets)", { recurrence: "monthly" });
    push("pet-banho", R(130), 18, "Banho e tosa");
    if (monthNum === 4) push("pet-veterinario", R(520), 14, "Vacinas anuais");
    else if (rnd.chance(0.2)) push("pet-veterinario", rnd.around(R(280), 0.5), rnd.int(1, 28), "Consulta veterinária");

    // ---------- Transporte, saúde, lazer ----------
    const rides = rnd.int(5, 12);
    for (let k = 0; k < rides; k++) push("transporte", rnd.around(R(28), 0.4), rnd.int(1, 28), "Corrida por app", { accountId: "acc-card" });
    push("plano-saude", R(520), 10, "Plano de saúde", { recurrence: "monthly" });
    push("academia", R(119.9), 5, "Academia", { recurrence: "monthly", accountId: "acc-card" });
    if (rnd.chance(0.5)) push("farmacia", rnd.around(R(85), 0.5), rnd.int(1, 28), "Farmácia");
    push("assinaturas", R(94.7), 7, "Streaming e música", { recurrence: "monthly", accountId: "acc-card" });
    push("assinaturas", R(110), 7, "Ferramentas de dev (IA, cloud)", { recurrence: "monthly", accountId: "acc-card" });

    const leisureBase = monthNum === 12 ? R(1_400) : monthNum === 7 ? R(900) : R(420);
    push("lazer", rnd.around(leisureBase, 0.3), rnd.int(10, 28), monthNum === 12 ? "Presentes e festas" : "Lazer", { accountId: "acc-card" });
    if (rnd.chance(0.35)) push("cursos", rnd.around(R(160), 0.4), rnd.int(1, 28), "Curso online", { accountId: "acc-card" });

    // Um gasto fora da curva para a detecção de anomalias ter o que mostrar.
    if (i === months - 7) push("outros", R(6_800), 22, "Notebook novo (à vista)", { accountId: "acc-card" });
  }

  // Orçamentos do mês atual e do anterior.
  const budgetDefs: [string, number][] = [
    ["mercado", 1_000],
    ["delivery", 400],
    ["lazer", 500],
    ["transporte", 250],
    ["pet-veterinario", 300],
  ];
  const budgets: Budget[] = [endMonth, addMonths(endMonth, -1)].flatMap((month) =>
    budgetDefs.map(([categoryId, limit]) => ({ id: `budget-${month}-${categoryId}`, categoryId, month, limit: R(limit) })),
  );

  transactions.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return { accounts: MOCK_ACCOUNTS, transactions, budgets, taxProfile: MOCK_TAX_PROFILE };
}
