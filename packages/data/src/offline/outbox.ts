import type { NewTransaction } from "../repository";

const DB_NAME = "chrise";
const DB_VERSION = 1;
const STORE_NAME = "outbox";

/**
 * Mutação que ainda não chegou ao servidor. A ordem de `list()` é a ordem de
 * criação, então um delete enfileirado depois de um create nunca o ultrapassa.
 */
export type PendingOperation =
  | { type: "create"; input: NewTransaction }
  | { type: "createMany"; inputs: NewTransaction[] }
  | { type: "update"; transactionId: string; patch: Partial<NewTransaction> }
  | { type: "delete"; transactionId: string };

export type OutboxOperation = PendingOperation & {
  id: string;
  createdAt: number;
  order: number;
};

export interface OutboxStore {
  all(): Promise<OutboxOperation[]>;
  put(operation: OutboxOperation): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

/** Fallback para ambientes sem IndexedDB (SSR, testes e navegação privada restrita). */
export class MemoryOutboxStore implements OutboxStore {
  private readonly items = new Map<string, OutboxOperation>();

  async all(): Promise<OutboxOperation[]> {
    return [...this.items.values()];
  }

  async put(operation: OutboxOperation): Promise<void> {
    this.items.set(operation.id, operation);
  }

  async remove(id: string): Promise<void> {
    this.items.delete(id);
  }

  async clear(): Promise<void> {
    this.items.clear();
  }
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Falha na requisição do IndexedDB"));
  });
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Falha ao abrir o IndexedDB"));
  });
}

/** Fila persistente: sobrevive a reload e a fechar o app no celular. */
export class IndexedDbOutboxStore implements OutboxStore {
  private database: Promise<IDBDatabase> | null = null;

  private db(): Promise<IDBDatabase> {
    this.database ??= openDatabase();
    return this.database;
  }

  private async run<T>(
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const db = await this.db();
    const transaction = db.transaction(STORE_NAME, mode);
    const result = await request(action(transaction.objectStore(STORE_NAME)));
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Falha na transação do IndexedDB"));
      transaction.onabort = () => reject(transaction.error ?? new Error("Transação do IndexedDB abortada"));
    });
    return result;
  }

  async all(): Promise<OutboxOperation[]> {
    return (await this.run("readonly", (store) => store.getAll())) as OutboxOperation[];
  }

  async put(operation: OutboxOperation): Promise<void> {
    await this.run("readwrite", (store) => store.put(operation));
  }

  async remove(id: string): Promise<void> {
    await this.run("readwrite", (store) => store.delete(id));
  }

  async clear(): Promise<void> {
    await this.run("readwrite", (store) => store.clear());
  }
}

export function createOutboxStore(): OutboxStore {
  return typeof indexedDB === "undefined" ? new MemoryOutboxStore() : new IndexedDbOutboxStore();
}

let sequence = 0;

function nextOrder(): number {
  sequence = (sequence + 1) % 1000;
  return Date.now() * 1000 + sequence;
}

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `op-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export class Outbox {
  constructor(private readonly store: OutboxStore = createOutboxStore()) {}

  async enqueue(operation: PendingOperation): Promise<OutboxOperation> {
    const entry: OutboxOperation = { ...operation, id: newId(), createdAt: Date.now(), order: nextOrder() };
    await this.store.put(entry);
    return entry;
  }

  async update(operation: OutboxOperation): Promise<void> {
    await this.store.put(operation);
  }

  async list(): Promise<OutboxOperation[]> {
    const items = await this.store.all();
    return items.sort((a, b) => a.order - b.order);
  }

  async remove(id: string): Promise<void> {
    await this.store.remove(id);
  }

  async clear(): Promise<void> {
    await this.store.clear();
  }

  async size(): Promise<number> {
    return (await this.store.all()).length;
  }
}

const PENDING_PREFIX = "pending:";

export const isPendingId = (id: string): boolean => id.startsWith(PENDING_PREFIX);

export function pendingId(operationId: string, index?: number): string {
  return `${PENDING_PREFIX}${operationId}${index === undefined ? "" : `:${index}`}`;
}

export function parsePendingId(id: string): { operationId: string; index?: number } | null {
  if (!isPendingId(id)) return null;
  const [operationId, rawIndex] = id.slice(PENDING_PREFIX.length).split(":");
  if (!operationId) return null;
  if (rawIndex === undefined) return { operationId };
  const index = Number(rawIndex);
  return Number.isInteger(index) ? { operationId, index } : { operationId };
}
