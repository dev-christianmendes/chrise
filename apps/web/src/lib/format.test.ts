import { describe, expect, it } from "vitest";
import { greeting, monthName, relativeDay, splitBRL, todayISO } from "./format";

const plain = (s: string) => s.replace(/\u00A0/g, " ");

describe("splitBRL", () => {
  it("separa inteiro e centavos", () => {
    const [int, cents] = splitBRL(123456);
    expect(plain(int)).toBe("R$ 1.234");
    expect(cents).toBe(",56");
  });

  it("mantém centavos zerados visíveis", () => {
    const [int, cents] = splitBRL(100);
    expect(plain(int)).toBe("R$ 1");
    expect(cents).toBe(",00");
  });
});

describe("relativeDay", () => {
  const today = "2026-11-09";

  it("usa palavras para hoje, ontem e amanhã", () => {
    expect(relativeDay(today, today)).toBe("Hoje");
    expect(relativeDay("2026-11-08", today)).toBe("Ontem");
    expect(relativeDay("2026-11-10", today)).toBe("Amanhã");
  });

  it("usa o dia da semana na última semana", () => {
    expect(relativeDay("2026-11-05", today)).toBe("Quinta-feira");
  });

  it("usa dia e mês abreviado quando é mais antigo", () => {
    expect(relativeDay("2026-10-03", today)).toBe("3 out.");
  });
});

describe("todayISO", () => {
  it("formata a data local como YYYY-MM-DD", () => {
    expect(todayISO(new Date(2026, 10, 9, 15, 30))).toBe("2026-11-09");
  });
});

describe("monthName", () => {
  it("devolve o mês por extenso", () => {
    expect(monthName("2026-11")).toBe("novembro");
    expect(monthName("2026-01")).toBe("janeiro");
  });
});

describe("greeting", () => {
  it("cumprimenta conforme o horário", () => {
    expect(greeting(new Date(2026, 10, 9, 3))).toBe("Boa madrugada");
    expect(greeting(new Date(2026, 10, 9, 9))).toBe("Bom dia");
    expect(greeting(new Date(2026, 10, 9, 15))).toBe("Boa tarde");
    expect(greeting(new Date(2026, 10, 9, 21))).toBe("Boa noite");
  });
});
