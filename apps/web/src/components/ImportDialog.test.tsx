import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { repository } from "@/lib/repository";
import { ImportDialog } from "./ImportDialog";
import { renderWithProviders } from "@/test/render";

const csv = [
  "Data;Descrição;Valor",
  "05/11/2026;Mercado Pão de Açúcar;-120,50",
  "06/11/2026;Nota fiscal;1500,00",
].join("\n");

async function uploadFile(content: string, name = "extrato.csv") {
  const input = document.getElementById("statement-file") as HTMLInputElement;
  const file = new File([content], name, { type: "text/csv" });
  fireEvent.change(input, { target: { files: [file] } });
}

describe("ImportDialog", () => {
  it("lê o CSV, mostra a prévia e importa os lançamentos", async () => {
    const user = userEvent.setup();
    const importMany = vi.spyOn(repository, "createTransactions").mockImplementation(async (inputs) =>
      inputs.map((input, i) => ({ ...input, id: `import-${i}` })),
    );
    renderWithProviders(<ImportDialog open onOpenChange={vi.fn()} />);

    await screen.findByRole("button", { name: /Escolher OFX ou CSV/ });
    await uploadFile(csv);

    expect(await screen.findByText("Mercado Pão de Açúcar")).toBeInTheDocument();
    expect(screen.getByText("Nota fiscal")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Importar \d+$/ }));

    await waitFor(() => expect(importMany).toHaveBeenCalledTimes(1));
    expect(importMany.mock.calls[0]![0]).toHaveLength(2);
  });

  it("mostra erro quando o arquivo não tem as colunas esperadas", async () => {
    renderWithProviders(<ImportDialog open onOpenChange={vi.fn()} />);

    await screen.findByRole("button", { name: /Escolher OFX ou CSV/ });
    await uploadFile("isto nao e um extrato");

    expect(await screen.findByRole("alert")).toHaveTextContent(/Não encontrei as colunas/);
  });
});
