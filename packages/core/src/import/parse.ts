import type { Cents, ISODate } from "../types";

/**
 * Leitura de extratos bancários (OFX e CSV) em um formato neutro.
 *
 * `amount` aqui é COM sinal (positivo = entrada, negativo = saída): o extrato
 * ainda não virou `Transaction`. A conversão acontece em `buildImportPlan`.
 */
export interface StatementEntry {
  date: ISODate;
  amount: Cents;
  description: string;
  /** ID estável vindo do banco (FITID do OFX, "Identificador" do Nubank…), quando existe. */
  externalId?: string;
}

export type StatementFormat = "ofx" | "csv";

export interface ParsedStatement {
  format: StatementFormat;
  entries: StatementEntry[];
  /** Linhas que não deu para interpretar (data ou valor inválido). */
  skipped: number;
  /** Fatura de cartão: valores positivos são gastos, então o sinal foi invertido. */
  invertedSigns: boolean;
}

// ---------------------------------------------------------------------------
// Valores e datas
// ---------------------------------------------------------------------------

/**
 * Converte valores escritos à brasileira ou à americana em centavos com sinal.
 * Aceita "1.234,56", "-1.234,56", "1234.56", "-50.00", "R$ 12,34", "(12,34)", "12,34-" e "12,34 D".
 * Retorna `null` se não for um número.
 */
export function parseAmount(input: string): Cents | null {
  let s = input.trim().replace(/R\$|\s| /g, "");
  if (!s) return null;

  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (/[dD]$/.test(s)) {
    negative = true;
    s = s.slice(0, -1);
  } else if (/[cC]$/.test(s)) {
    s = s.slice(0, -1);
  }
  if (s.endsWith("-")) {
    negative = true;
    s = s.slice(0, -1);
  }
  if (s.startsWith("-")) {
    negative = !negative;
    s = s.slice(1);
  } else if (s.startsWith("+")) {
    s = s.slice(1);
  }
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  let normalized: string;
  if (lastComma >= 0 && lastDot >= 0) {
    // O separador que aparece por último é o decimal.
    normalized = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastComma >= 0) {
    normalized = s.split(",").length > 2 ? s.replace(/,/g, "") : s.replace(",", ".");
  } else if (lastDot >= 0) {
    // "1.234" (3 dígitos depois do ponto) é milhar; "12.5" e "12.34" são decimais.
    const decimals = s.length - lastDot - 1;
    normalized = s.split(".").length > 2 || decimals === 3 ? s.replace(/\./g, "") : s;
  } else {
    normalized = s;
  }

  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  const cents = Math.round(value * 100);
  return negative ? -cents : cents;
}

const pad = (n: number) => String(n).padStart(2, "0");

function validDate(y: number, m: number, d: number): ISODate | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null; // 31/02 etc.
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** Aceita "31/12/2026", "31/12/26", "31-12-2026", "2026-12-31" e "20261231…" (OFX). */
export function parseDate(input: string): ISODate | null {
  const s = input.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return validDate(+m[1]!, +m[2]!, +m[3]!);
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(s.split(/\s/)[0]!);
  if (m) {
    const y = m[3]!.length === 2 ? 2000 + +m[3]! : +m[3]!;
    return validDate(y, +m[2]!, +m[1]!);
  }
  m = /^(\d{4})(\d{2})(\d{2})/.exec(s);
  if (m) return validDate(+m[1]!, +m[2]!, +m[3]!);
  return null;
}

// ---------------------------------------------------------------------------
// Texto: encoding
// ---------------------------------------------------------------------------

/**
 * Bancos brasileiros ainda exportam muito em Windows-1252 (Latin-1).
 * Tenta UTF-8 estrito e, se falhar, cai para 1252.
 */
export function decodeStatement(bytes: ArrayBuffer | Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^﻿/, "");
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

// ---------------------------------------------------------------------------
// OFX
// ---------------------------------------------------------------------------

const cleanText = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

/** OFX 1.x é SGML (tags sem fechamento) e 2.x é XML; ler por tag funciona nos dois. */
function ofxField(block: string, tag: string): string | undefined {
  const m = new RegExp(`<${tag}>([^<\\r\\n]*)`, "i").exec(block);
  return m ? cleanText(m[1]!) : undefined;
}

export function parseOFX(text: string): ParsedStatement {
  const blocks = text.split(/<STMTTRN>/i).slice(1).map((b) => b.split(/<\/STMTTRN>/i)[0]!);
  const entries: StatementEntry[] = [];
  let skipped = 0;

  for (const block of blocks) {
    const date = parseDate(ofxField(block, "DTPOSTED") ?? "");
    const amount = parseAmount(ofxField(block, "TRNAMT") ?? "");
    if (!date || amount === null || amount === 0) {
      skipped++;
      continue;
    }
    const memo = ofxField(block, "MEMO");
    const name = ofxField(block, "NAME");
    const description = [name, memo].filter((v, i, arr) => v && arr.indexOf(v) === i).join(" - ") || "Sem descrição";
    const fitid = ofxField(block, "FITID");
    entries.push({ date, amount, description, ...(fitid ? { externalId: fitid } : {}) });
  }

  // No OFX, inclusive de cartão (CCSTMTRS), negativo já é saída: não invertemos.
  return { format: "ofx", entries, skipped, invertedSigns: false };
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/** Divide CSV respeitando aspas ("a;b" não quebra; "" vira "). */
export function splitCSV(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).slice(0, 20).join("\n");
  const count = (d: string) => splitCSV(sample, d).reduce((acc, r) => acc + r.length - 1, 0);
  return [";", ",", "\t"].reduce((best, d) => (count(d) > count(best) ? d : best), ";");
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

interface Columns {
  date: number;
  description: number[];
  amount?: number;
  credit?: number;
  debit?: number;
  id?: number;
}

const findCol = (header: string[], re: RegExp, except: number[] = []) =>
  header.findIndex((h, i) => re.test(h) && !except.includes(i));

function detectColumns(header: string[]): Columns | null {
  const h = header.map(norm);
  const date = findCol(h, /^(data|date|dt)\b|data (de )?(lancamento|movimento|transacao|compra)/);
  if (date < 0) return null;
  const amount = findCol(h, /^(valor|amount|value|quantia)\b/, [date]);
  const credit = findCol(h, /^(credito|entrada)s?\b/, [date]);
  const debit = findCol(h, /^(debito|saida)s?\b/, [date]);
  const description = h
    .map((name, i) => (i !== date && i !== amount && /descri|historico|^title$|^titulo|lancamento|^memo|estabelecimento|^detalhe/.test(name) ? i : -1))
    .filter((i) => i >= 0);
  const id = findCol(h, /^(identificador|id|fitid|codigo)$/, [date]);
  if (description.length === 0 || (amount < 0 && (credit < 0 || debit < 0))) return null;
  return {
    date,
    description,
    ...(amount >= 0 ? { amount } : { credit, debit }),
    ...(id >= 0 ? { id } : {}),
  };
}

export function parseCSV(text: string): ParsedStatement {
  const rows = splitCSV(text, detectDelimiter(text));

  // Alguns bancos (Inter, Itaú) põem linhas de cabeçalho antes da tabela.
  let headerIdx = -1;
  let cols: Columns | null = null;
  for (let i = 0; i < Math.min(rows.length, 30) && !cols; i++) {
    cols = detectColumns(rows[i]!);
    if (cols) headerIdx = i;
  }
  if (!cols) throw new Error("Não encontrei as colunas de data, descrição e valor neste CSV.");

  const header = rows[headerIdx]!.map(norm);
  // Fatura do cartão Nubank (date,title,amount): positivo = compra.
  const invertedSigns = header.join(",") === "date,title,amount" || (header.includes("category") && header.includes("title"));

  const entries: StatementEntry[] = [];
  let skipped = 0;
  for (const row of rows.slice(headerIdx + 1)) {
    const date = parseDate(row[cols.date] ?? "");
    let amount: Cents | null;
    if (cols.amount !== undefined) {
      amount = parseAmount(row[cols.amount] ?? "");
    } else {
      const credit = parseAmount(row[cols.credit!] ?? "") ?? 0;
      const debit = parseAmount(row[cols.debit!] ?? "") ?? 0;
      amount = Math.abs(credit) - Math.abs(debit);
    }
    const description = cols.description
      .map((i) => cleanText(row[i] ?? ""))
      .filter((v, i, arr) => v && arr.indexOf(v) === i)
      .join(" - ");
    if (!date || amount === null || amount === 0) {
      // Linhas de saldo ("SALDO DO DIA") e rodapés caem aqui.
      skipped++;
      continue;
    }
    if (/^saldo\b/i.test(norm(description))) {
      skipped++;
      continue;
    }
    const externalId = cols.id !== undefined ? row[cols.id]?.trim() : undefined;
    entries.push({
      date,
      amount: invertedSigns ? -amount : amount,
      description: description || "Sem descrição",
      ...(externalId ? { externalId } : {}),
    });
  }
  return { format: "csv", entries, skipped, invertedSigns };
}

/** Escolhe o parser pelo conteúdo (não confia só na extensão). */
export function parseStatement(text: string): ParsedStatement {
  if (/OFXHEADER|<OFX>|<STMTTRN>/i.test(text)) return parseOFX(text);
  return parseCSV(text);
}
