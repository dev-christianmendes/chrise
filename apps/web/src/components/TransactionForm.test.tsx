import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { repository } from "@/lib/repository";
import { TransactionForm } from "./TransactionForm";
import { renderWithProviders } from "@/test/render";

describe("TransactionForm", () => {
  it("só habilita Salvar depois de valor e categoria", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TransactionForm open onOpenChange={vi.fn()} />);

    expect(await screen.findByText("Novo lançamento")).toBeInTheDocument();
    const save = screen.getByRole("button", { name: "Salvar" });
    expect(save).toBeDisabled();

    await user.type(screen.getByPlaceholderText("0,00"), "45,90");
    expect(save).toBeDisabled();

    await user.click(await screen.findByRole("button", { name: /Delivery/ }));
    expect(save).toBeEnabled();
  });

  it("envia o valor em centavos e a categoria escolhida", async () => {
    const user = userEvent.setup();
    const create = vi.spyOn(repository, "createTransaction").mockResolvedValue({
      id: "nova",
      accountId: "acc-pj",
      categoryId: "delivery",
      kind: "expense",
      amount: 4590,
      description: "Delivery",
      date: "2026-11-09",
      status: "paid",
      recurrence: "none",
    });
    const onOpenChange = vi.fn();
    renderWithProviders(<TransactionForm open onOpenChange={onOpenChange} />);

    await user.type(await screen.findByPlaceholderText("0,00"), "45,90");
    await user.click(await screen.findByRole("button", { name: /Delivery/ }));
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 4590, kind: "expense", categoryId: "delivery" }),
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("troca as categorias ao alternar para Entrada", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TransactionForm open onOpenChange={vi.fn()} />);

    await user.click(await screen.findByRole("radio", { name: "Entrada" }));
    expect(await screen.findByRole("button", { name: /Nota fiscal \(PJ\)/ })).toBeInTheDocument();
  });
});
