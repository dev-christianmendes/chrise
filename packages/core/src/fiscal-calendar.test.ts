import { describe, expect, it } from "vitest";
import { buildFiscalCalendar, dasDueDate, defisDueDate, irpfDueDate } from "./fiscal-calendar";

describe("datas de referência", () => {
  it("calcula DAS no dia 20 do mês seguinte", () => {
    expect(dasDueDate("2026-10")).toBe("2026-11-20");
    expect(dasDueDate("2026-12")).toBe("2027-01-20");
  });

  it("calcula DEFIS e IRPF no ano seguinte", () => {
    expect(defisDueDate(2027)).toBe("2027-03-31");
    expect(irpfDueDate(2027)).toBe("2027-04-30");
  });
});

describe("buildFiscalCalendar", () => {
  it("monta os próximos vencimentos em ordem, com DAS, DEFIS e IRPF", () => {
    const events = buildFiscalCalendar({
      today: "2026-11-09",
      months: 6,
      dasAmountFor: (month) => (month === "2026-10" ? 12_345 : undefined),
    });

    expect(events.map((event) => `${event.id}@${event.dueDate}`)).toEqual([
      "das:2026-10@2026-11-20",
      "das:2026-11@2026-12-20",
      "das:2026-12@2027-01-20",
      "das:2027-01@2027-02-20",
      "das:2027-02@2027-03-20",
      "defis:2027@2027-03-31",
      "das:2027-03@2027-04-20",
      "irpf:2027@2027-04-30",
      "das:2027-04@2027-05-20",
    ]);
  });

  it("preenche valor, competência e contagem de dias do DAS", () => {
    const events = buildFiscalCalendar({
      today: "2026-11-09",
      months: 6,
      dasAmountFor: (month) => (month === "2026-10" ? 12_345 : undefined),
    });
    const first = events[0]!;

    expect(first.amount).toBe(12_345);
    expect(first.referenceLabel).toBe("Competência Out/26");
    expect(first.status).toBe("upcoming");
    expect(first.daysUntil).toBe(11);
    expect(events[1]!.amount).toBeUndefined();
  });

  it("identifica vencimento atrasado dentro da janela de lookback", () => {
    const events = buildFiscalCalendar({ today: "2026-11-25", months: 1, lookbackDays: 30 });

    expect(events.map((event) => event.id)).toEqual(["das:2026-10", "das:2026-11"]);
    expect(events[0]!.status).toBe("overdue");
    expect(events[0]!.daysUntil).toBe(-5);
  });

  it("marca vencimento de hoje", () => {
    const events = buildFiscalCalendar({ today: "2026-11-20", months: 1, lookbackDays: 0 });

    expect(events[0]!.id).toBe("das:2026-10");
    expect(events[0]!.status).toBe("today");
    expect(events[0]!.daysUntil).toBe(0);
  });

  it("sem lookback, não mostra o que já venceu", () => {
    const events = buildFiscalCalendar({ today: "2026-11-25", months: 1, lookbackDays: 0 });

    expect(events.map((event) => event.dueDate)).toEqual(["2026-12-20"]);
  });

  it("normaliza horizonte mínimo de um mês", () => {
    const events = buildFiscalCalendar({ today: "2026-11-09", months: 0 });

    expect(events.every((event) => event.kind === "das")).toBe(true);
    expect(events).toHaveLength(2);
  });
});
