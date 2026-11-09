import {
  MockRepository,
  OfflineRepository,
  Outbox,
  SupabaseRepository,
  type FinanceRepository,
  type SyncResult,
} from "@chrise/data";
import { getSupabase } from "./supabase";

export const DATA_SOURCE: "mock" | "supabase" = import.meta.env.VITE_DATA_SOURCE === "supabase" ? "supabase" : "mock";
export const IS_DEMO = DATA_SOURCE === "mock";

let offline: OfflineRepository | null = null;

async function buildRepository(): Promise<FinanceRepository> {
  if (IS_DEMO) return new MockRepository();
  offline = new OfflineRepository(new SupabaseRepository(await getSupabase()), new Outbox());
  return offline;
}

/** Único ponto do app que sabe qual adapter está em uso. */
export const repository = await buildRepository();

/** Drena a fila offline (produção). Na demo não há fila. */
export async function syncPending(): Promise<SyncResult> {
  if (!offline) return { synced: 0, failed: 0, pending: 0 };
  return offline.sync();
}
