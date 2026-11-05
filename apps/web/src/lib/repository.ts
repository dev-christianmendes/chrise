import { MockRepository, SupabaseRepository, type FinanceRepository } from "@chrise/data";
import { getSupabase } from "./supabase";

export const DATA_SOURCE: "mock" | "supabase" = import.meta.env.VITE_DATA_SOURCE === "supabase" ? "supabase" : "mock";
export const IS_DEMO = DATA_SOURCE === "mock";

/** Único ponto do app que sabe qual adapter está em uso. */
export const repository: FinanceRepository = IS_DEMO
  ? new MockRepository()
  : new SupabaseRepository(await getSupabase());
