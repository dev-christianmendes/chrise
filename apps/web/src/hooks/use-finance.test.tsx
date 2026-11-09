import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Transaction } from "@chrise/core";
import type { NewTransaction } from "@chrise/data";
import { repository } from "@/lib/repository";
import { useCreateTransaction, useTransactions } from "./use-finance";

const input: NewTransaction = {
  accountId: "acc-1",
  categoryId: "cat-1",
  kind: "expense",
  amount: 4590,
  description: "Teste otimista",
  date: "2026-11-09",
  status: "paid",
  recurrence: "none",
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function Harness() {
  const list = useTransactions();
  const create = useCreateTransaction();

  return (
    <div>
      <output data-testid="count">{list.data?.length ?? -1}</output>
      <output data-testid="descriptions">{list.data?.map((item) => item.description).join("|") ?? ""}</output>
      <button onClick={() => create.mutate(input)}>criar</button>
    </div>
  );
}

function renderHarness() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <Harness />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useCreateTransaction", () => {
  it("mostra o lançamento otimista e reconcilia com o servidor", async () => {
    const server = deferred<Transaction>();
    vi.spyOn(repository, "listTransactions").mockResolvedValue([]);
    vi.spyOn(repository, "createTransaction").mockReturnValue(server.promise);

    renderHarness();
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("0"));

    fireEvent.click(screen.getByRole("button", { name: "criar" }));
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));
    expect(screen.getByTestId("descriptions")).toHaveTextContent("Teste otimista");

    await act(async () => {
      server.resolve({ ...input, id: "srv-1" });
    });

    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("0"));
  });

  it("desfaz o lançamento otimista quando a gravação falha", async () => {
    const server = deferred<Transaction>();
    vi.spyOn(repository, "listTransactions").mockResolvedValue([]);
    vi.spyOn(repository, "createTransaction").mockReturnValue(server.promise);

    renderHarness();
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("0"));

    fireEvent.click(screen.getByRole("button", { name: "criar" }));
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));

    await act(async () => {
      server.reject(new Error("falhou"));
    });

    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("0"));
  });
});
