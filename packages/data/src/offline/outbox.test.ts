import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import type { NewTransaction } from "../repository";
import {
  IndexedDbOutboxStore,
  MemoryOutboxStore,
  Outbox,
  parsePendingId,
  pendingId,
  type OutboxStore,
} from "./outbox";

const input = (description: string): NewTransaction => ({
  accountId: "acc-1",
  categoryId: "cat-1",
  kind: "expense",
  amount: 1290,
  description,
  date: "2026-11-09",
  status: "paid",
  recurrence: "none",
});

const factories: Array<[string, () => OutboxStore]> = [
  ["memória", () => new MemoryOutboxStore()],
  ["IndexedDB", () => new IndexedDbOutboxStore()],
];

describe.each(factories)("Outbox com store %s", (_name, createStore) => {
  let outbox: Outbox;

  beforeEach(async () => {
    outbox = new Outbox(createStore());
    await outbox.clear();
  });

  it("enfileira e lista na ordem de criação", async () => {
    const first = await outbox.enqueue({ type: "create", input: input("primeiro") });
    const second = await outbox.enqueue({ type: "createMany", inputs: [input("segundo"), input("terceiro")] });
    const third = await outbox.enqueue({ type: "delete", transactionId: "tx-1" });

    expect((await outbox.list()).map((operation) => operation.id)).toEqual([first.id, second.id, third.id]);
    expect(await outbox.size()).toBe(3);
  });

  it("remove e limpa operações", async () => {
    const operation = await outbox.enqueue({ type: "delete", transactionId: "tx-1" });
    await outbox.remove(operation.id);
    expect(await outbox.size()).toBe(0);

    await outbox.enqueue({ type: "create", input: input("a") });
    await outbox.enqueue({ type: "create", input: input("b") });
    await outbox.clear();
    expect(await outbox.list()).toEqual([]);
  });
});

describe("IndexedDbOutboxStore", () => {
  it("persiste a fila entre instâncias do app", async () => {
    const first = new Outbox(new IndexedDbOutboxStore());
    await first.clear();
    const operation = await first.enqueue({ type: "create", input: input("persistido") });

    const second = new Outbox(new IndexedDbOutboxStore());
    expect((await second.list()).map((item) => item.id)).toEqual([operation.id]);

    await second.clear();
  });
});

describe("ids pendentes", () => {
  it("codifica e decodifica operação e índice", () => {
    expect(parsePendingId(pendingId("op-1"))).toEqual({ operationId: "op-1" });
    expect(parsePendingId(pendingId("op-1", 3))).toEqual({ operationId: "op-1", index: 3 });
  });

  it("ignora ids que não são pendentes", () => {
    expect(parsePendingId("7f5c5c48-0000-4000-8000-000000000000")).toBeNull();
    expect(parsePendingId("pending:" )).toBeNull();
  });
});
