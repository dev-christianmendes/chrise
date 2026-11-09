import type { MonthSummaryInput } from "@chrise/core";
import { IS_DEMO } from "./repository";
import { getSupabase } from "./supabase";

/**
 * Pede uma reescrita à Edge Function. Devolve `null` quando a demo está ativa,
 * a função não responde ou o texto é rejeitado; a UI mantém o resumo calculado.
 */
export async function requestExplanation(input: MonthSummaryInput): Promise<string | null> {
  if (IS_DEMO) return null;

  try {
    const { data, error } = await (await getSupabase()).functions.invoke("explain", { body: input });
    if (error || !data || typeof data.text !== "string" || data.text.trim().length === 0) return null;
    return data.text.trim();
  } catch {
    return null;
  }
}
