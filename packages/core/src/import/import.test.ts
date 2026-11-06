import { describe, expect, it } from "vitest";
import type { Category, Transaction } from "../types";
import { learnFromHistory, normalizeDescription, suggestCategory } from "./categorize";
import { decodeStatement, parseAmount, parseCSV, parseDate, parseOFX, parseStatement } from "./parse";
import { buildImportPlan, rowToTransaction } from "./plan";

const cat = (id: string, kind: "income" | "expense" = "expense"): Category => ({
  id,
  name: id,
  group: "outros",
  kind,
  nature: "variable",
  color: "red",
});
const categories = [
  cat("delivery"),
  cat("transporte"),
  cat("mercado"),
  cat("aluguel"),
  cat("farmacia"),
  cat("outros"),
  cat("nf-servicos", "income"),
  cat("rendimentos", "income"),
];

let seq = 0;
const tx = (p: Partial<Transaction>): Transaction => ({
  id: String(++seq),
  accountId: "a",
  categoryId: "outros",
  kind: "expense",
  amount: 1000,
  description: "x",
  date: "2026-10-01",
  status: "paid",
  recurrence: "none",
  ...p,
});

describe("parseAmount", () => {
  it.each([
    ["1.234,56", 123456],
    ["-1.234,56", -123456],
    ["1234.56", 123456],
    ["-50.00", -5000],
    ["R$ 12,34", 1234],
    ["R$ -12,34", -1234],
    ["(12,34)", -1234],
    ["12,34-", -1234],
    ["12,34 D", -1234],
    ["12,34 C", 1234],
    ["1.234", 123400],
    ["12.5", 1250],
    ["1,234.56", 123456],
    ["0,1", 10],
  ])("%s → %d", (input, cents) => expect(parseAmount(input)).toBe(cents));

  it.each(["", "abc", "-", "R$"])("rejeita %j", (input) => expect(parseAmount(input)).toBeNull());
});

describe("parseDate", () => {
  it.each([
    ["31/12/2026", "2026-12-31"],
    ["1/2/26", "2026-02-01"],
    ["31-12-2026", "2026-12-31"],
    ["2026-12-31", "2026-12-31"],
    ["20261231120000[-3:BRT]", "2026-12-31"],
    ["05/11/2026 14:32", "2026-11-05"],
  ])("%s → %s", (input, iso) => expect(parseDate(input)).toBe(iso));

  it.each(["31/02/2026", "13/13/2026", "ontem", ""])("rejeita %j", (input) => expect(parseDate(input)).toBeNull());
});

describe("decodeStatement", () => {
  it("lê UTF-8 e cai para Windows-1252", () => {
    expect(decodeStatement(new TextEncoder().encode("Farmácia"))).toBe("Farmácia");
    expect(decodeStatement(new Uint8Array([0x46, 0x61, 0x72, 0x6d, 0xe1, 0x63, 0x69, 0x61]))).toBe("Farmácia");
  });
});

describe("parseOFX", () => {
  const ofx = `OFXHEADER:100
DATA:OFXSGML
CHARSET:1252

<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261103000000[-3:BRT]
<TRNAMT>-45.90
<FITID>abc1
<MEMO>IFOOD *RESTAURANTE
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20261105
<TRNAMT>15000.00
<FITID>abc2
<NAME>ACME LTDA
<MEMO>TED RECEBIDA
</STMTTRN>
<STMTTRN>
<DTPOSTED>lixo
<TRNAMT>1.00
</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

  it("lê transações SGML, junta NAME e MEMO e guarda o FITID", () => {
    const parsed = parseOFX(ofx);
    expect(parsed.entries).toEqual([
      { date: "2026-11-03", amount: -4590, description: "IFOOD *RESTAURANTE", externalId: "abc1" },
      { date: "2026-11-05", amount: 1500000, description: "ACME LTDA - TED RECEBIDA", externalId: "abc2" },
    ]);
    expect(parsed.skipped).toBe(1);
  });

  it("parseStatement detecta OFX pelo conteúdo", () => {
    expect(parseStatement(ofx).format).toBe("ofx");
  });
});

describe("parseCSV", () => {
  it("extrato da conta Nubank (vírgula, valor com ponto, Identificador)", () => {
    const csv = `Data,Valor,Identificador,Descrição
03/11/2026,-45.90,id-1,"Compra no débito - IFOOD"
05/11/2026,15000.00,id-2,Transferência recebida - ACME LTDA`;
    const { entries, invertedSigns } = parseCSV(csv);
    expect(invertedSigns).toBe(false);
    expect(entries).toEqual([
      { date: "2026-11-03", amount: -4590, description: "Compra no débito - IFOOD", externalId: "id-1" },
      { date: "2026-11-05", amount: 1500000, description: "Transferência recebida - ACME LTDA", externalId: "id-2" },
    ]);
  });

  it("fatura do cartão Nubank inverte o sinal (positivo = compra)", () => {
    const csv = `date,title,amount
2026-11-03,Uber *Trip,23.50
2026-11-04,Pagamento recebido,-500.00`;
    const { entries, invertedSigns } = parseCSV(csv);
    expect(invertedSigns).toBe(true);
    expect(entries.map((e) => e.amount)).toEqual([-2350, 50000]);
  });

  it("Inter: ponto e vírgula, linhas antes do cabeçalho, histórico + descrição e linha de saldo", () => {
    const csv = `Extrato Conta Corrente
Conta ;123456
Período ;01/11/2026 a 30/11/2026

Data Lançamento;Histórico;Descrição;Valor;Saldo
03/11/2026;Pix enviado ;Joao Silva;-2.500,00;10.000,00
04/11/2026;Saldo do dia;;0,00;10.000,00
05/11/2026;Pagamento efetuado;Drogasil;-89,90;9.910,10`;
    const { entries, skipped } = parseCSV(csv);
    expect(entries).toEqual([
      { date: "2026-11-03", amount: -250000, description: "Pix enviado - Joao Silva" },
      { date: "2026-11-05", amount: -8990, description: "Pagamento efetuado - Drogasil" },
    ]);
    expect(skipped).toBe(1);
  });

  it("colunas separadas de crédito e débito", () => {
    const csv = `Data;Descrição;Crédito;Débito
03/11/2026;Mercado;;120,00
04/11/2026;Salário;3.000,00;`;
    expect(parseCSV(csv).entries.map((e) => e.amount)).toEqual([-12000, 300000]);
  });

  it("explica quando não reconhece as colunas", () => {
    expect(() => parseCSV("a;b\n1;2")).toThrow(/colunas/);
  });
});

describe("categorização", () => {
  it("normaliza acentos, números e pontuação", () => {
    expect(normalizeDescription("Compra no Débito - IFOOD *Rest 1234 (2/3)")).toBe("compra no debito ifood rest");
  });

  it("histórico vence a regra padrão e respeita o tipo", () => {
    const learned = learnFromHistory([
      tx({ description: "PIX ENVIADO JOAO 01", categoryId: "aluguel" }),
      tx({ description: "Pix enviado Joao 02", categoryId: "aluguel" }),
      tx({ description: "Pix enviado Joao", categoryId: "outros" }),
    ]);
    const ctx = { categories, learned };
    expect(suggestCategory("PIX ENVIADO - JOAO 03", "expense", ctx)).toEqual({ categoryId: "aluguel", source: "history" });
    expect(suggestCategory("PIX ENVIADO - JOAO 03", "income", ctx).source).toBe("fallback");
  });

  it("regras padrão: palavra inteira e ordem (Uber Eats é delivery, Uber é transporte)", () => {
    const ctx = { categories, learned: new Map() };
    expect(suggestCategory("UBER EATS *PEDIDO", "expense", ctx).categoryId).toBe("delivery");
    expect(suggestCategory("UBER *TRIP HELP.UBER.COM", "expense", ctx).categoryId).toBe("transporte");
    expect(suggestCategory("Pagamento efetuado - Drogasil", "expense", ctx).categoryId).toBe("farmacia");
    // "superuber" não é "uber"
    expect(suggestCategory("SUPERUBERX LTDA", "expense", ctx)).toEqual({ categoryId: "outros", source: "fallback" });
  });

  it("receita sem regra cai em rendimentos, nunca em faturamento PJ", () => {
    const ctx = { categories, learned: new Map() };
    expect(suggestCategory("TED RECEBIDA ACME", "income", ctx)).toEqual({ categoryId: "rendimentos", source: "fallback" });
  });
});

describe("buildImportPlan", () => {
  const entries = [
    { date: "2026-11-03", amount: -4590, description: "IFOOD" },
    { date: "2026-11-03", amount: -4590, description: "IFOOD" },
    { date: "2026-11-05", amount: 1500000, description: "ACME", externalId: "fit-9" },
  ];

  it("converte sinal em tipo e gera tags estáveis e distintas para linhas iguais", () => {
    const plan = buildImportPlan({ entries, existing: [], categories });
    expect(plan.map((r) => [r.kind, r.amount, r.include])).toEqual([
      ["expense", 4590, true],
      ["expense", 4590, true],
      ["income", 1500000, true],
    ]);
    expect(new Set(plan.map((r) => r.importTag)).size).toBe(3);
    expect(buildImportPlan({ entries, existing: [], categories }).map((r) => r.importTag)).toEqual(plan.map((r) => r.importTag));
  });

  it("reimportar o mesmo arquivo marca tudo como já importado", () => {
    const first = buildImportPlan({ entries, existing: [], categories });
    const saved = first.map((r, i) => ({ ...rowToTransaction(r, "acc", "2026-11-06"), id: `t${i}` }));
    const again = buildImportPlan({ entries, existing: saved, categories });
    expect(again.every((r) => r.duplicate === "imported" && !r.include)).toBe(true);
  });

  it("lançamento manual igual marca só UMA linha como provável duplicado", () => {
    const manual = tx({ date: "2026-11-03", amount: 4590, kind: "expense", description: "Delivery" });
    const plan = buildImportPlan({ entries, existing: [manual], categories });
    expect(plan.map((r) => r.duplicate)).toEqual(["probable", undefined, undefined]);
    expect(plan.map((r) => r.include)).toEqual([false, true, true]);
  });

  it("rowToTransaction: status pelo dia, faturamento PJ só em categoria de NF", () => {
    const [row] = buildImportPlan({ entries: [entries[2]!], existing: [], categories });
    const t = rowToTransaction(row!, "acc", "2026-11-04");
    expect(t).toMatchObject({ status: "pending", isBusinessRevenue: false, categoryId: "rendimentos", tags: [row!.importTag] });
    expect(rowToTransaction({ ...row!, categoryId: "nf-servicos" }, "acc", "2026-11-06")).toMatchObject({
      status: "paid",
      isBusinessRevenue: true,
    });
  });
});
