import type { SupabaseClient } from "@supabase/supabase-js";

let client: Promise<SupabaseClient> | null = null;

/**
 * Cliente Supabase carregado sob demanda (import dinâmico): a demo (mock)
 * nunca baixa o supabase-js, o que mantém o bundle inicial pequeno no celular.
 */
export function getSupabase(): Promise<SupabaseClient> {
  client ??= import("@supabase/supabase-js").then(({ createClient }) => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error("VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórias com VITE_DATA_SOURCE=supabase.");
    }
    return createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } });
  });
  return client;
}
