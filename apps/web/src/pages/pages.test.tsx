import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import Budgets from "./Budgets";
import Forecast from "./Forecast";
import Settings from "./Settings";
import Taxes from "./Taxes";
import { renderWithProviders } from "@/test/render";

describe("páginas", () => {
  it("Impostos mostra o DAS e o Fator R", async () => {
    renderWithProviders(<Taxes />, { route: "/taxes" });
    expect(await screen.findByRole("heading", { name: "Impostos" })).toBeInTheDocument();
    expect(await screen.findByText("Fator R")).toBeInTheDocument();
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
