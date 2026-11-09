import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { repository } from "@/lib/repository";
import Transactions from "./Transactions";
import { renderWithProviders } from "@/test/render";

describe("Extrato", () => {
  it("mostra o título e os filtros", async () => {
    renderWithProviders(<Transactions />, { route: "/transactions" });

    expect(await screen.findByRole("heading", { name: "Extrato" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Buscar lançamento")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Importar/ })).toBeInTheDocument();
  });

  it("mostra o estado vazio quando a busca não encontra nada", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Transactions />, { route: "/transactions" });

    await user.type(await screen.findByPlaceholderText("Buscar lançamento"), "zzz-nao-existe");
    expect(await screen.findByText("Nada por aqui.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Limpar busca" }));
    expect(await screen.findAllByRole("listitem")).not.toHaveLength(0);
  });

  it("alterna o filtro de tipo", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Transactions />, { route: "/transactions" });

    const saidas = await screen.findByRole("radio", { name: "Saídas" });
    await user.click(saidas);
    expect(saidas).toHaveAttribute("aria-checked", "true");
  });

  it("exclui um lançamento pelo painel expandido", async () => {
    const user = userEvent.setup();
    const remove = vi.spyOn(repository, "deleteTransaction").mockResolvedValue(undefined);
    renderWithProviders(<Transactions />, { route: "/transactions" });

    const items = await screen.findAllByRole("listitem");
    const row = items.map((item) => item.querySelector("button[aria-expanded]")).find(Boolean) as HTMLButtonElement;
    await user.click(row);

    const deleteButton = await screen.findByRole("button", { name: /Excluir/ });
    await user.click(deleteButton);

    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith(expect.any(String));
  });
});
