import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import Budgets from "./Budgets";
import Calendar from "./Calendar";
import Forecast from "./Forecast";
import Settings from "./Settings";
import Taxes from "./Taxes";
import { renderWithProviders } from "@/test/render";

describe("páginas", () => {
  it("Impostos mostra o DAS e o Fator R", async () => {
    renderWithProviders(<Taxes />, { route: "/taxes" });
    expect(await screen.findByRole("heading", { name: "Impostos" })).toBeInTheDocument();
    expect(await screen.findByText("Fator R")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Abrir calendário fiscal" })).toBeInTheDocument();
  });

  it("Calendário fiscal lista DAS, DEFIS e IRPF", async () => {
    renderWithProviders(<Calendar />, { route: "/calendar" });
    expect(await screen.findByRole("heading", { name: "Calendário fiscal" })).toBeInTheDocument();
    expect(await screen.findByText("Próximos vencimentos")).toBeInTheDocument();
    expect((await screen.findAllByText("DAS — Simples Nacional")).length).toBeGreaterThan(0);
    expect(await screen.findByText("DEFIS")).toBeInTheDocument();
    expect(await screen.findByText("IRPF")).toBeInTheDocument();
    expect(await screen.findByText(/confirme no portal oficial/)).toBeInTheDocument();
  });

  it("Futuro mostra a projeção e o simulador", async () => {
    renderWithProviders(<Forecast />, { route: "/forecast" });
    expect(await screen.findByRole("heading", { name: "Futuro" })).toBeInTheDocument();
    expect(await screen.findByText("Simulador de longo prazo")).toBeInTheDocument();
  });

  it("Limites mostra os orçamentos do mês", async () => {
    renderWithProviders(<Budgets />, { route: "/budgets" });
    expect(await screen.findByRole("heading", { name: "Limites" })).toBeInTheDocument();
  });

  it("Ajustes mostra as preferências", async () => {
    renderWithProviders(<Settings />, { route: "/settings" });
    expect(await screen.findByRole("heading", { name: "Ajustes" })).toBeInTheDocument();
    expect(await screen.findByText("Aparência")).toBeInTheDocument();
  });
});
