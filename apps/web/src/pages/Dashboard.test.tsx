import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import Dashboard from "./Dashboard";
import { renderWithProviders } from "@/test/render";

describe("Dashboard", () => {
  it("abre o cofre com o resumo do mês", async () => {
    renderWithProviders(<Dashboard />, { route: "/" });

    expect(await screen.findByText(/Livre para gastar em/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Separar p\/ imposto/i })).toHaveAttribute("href", "/taxes");
    expect(screen.getByRole("link", { name: /Saldo em 6 meses/i })).toHaveAttribute("href", "/forecast");
  });

  it("lista os lançamentos recentes", async () => {
    renderWithProviders(<Dashboard />, { route: "/" });

    expect(await screen.findByText("Últimos lançamentos")).toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: /Ver tudo/ });
    expect(links.length).toBeGreaterThan(0);
    expect(links.every((link) => link.getAttribute("href") === "/transactions")).toBe(true);
  });
});
