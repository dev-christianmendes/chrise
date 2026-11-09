import { createClient } from "npm:@supabase/supabase-js@2";
import { EXPLAIN_PROMPT_VERSION, buildPrompt, isSafeExplanation, parseSummaryInput } from "./explain.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const unavailable = (reason: string) =>
  json({ text: null, reason, promptVersion: EXPLAIN_PROMPT_VERSION });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "method-not-allowed" }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization) return json({ error: "unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return json({ error: "misconfigured" }, 500);

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return json({ error: "unauthorized" }, 401);

  const raw = await request.text();
  if (raw.length > 8_000) return json({ error: "payload-too-large" }, 413);

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "invalid-json" }, 400);
  }

  const input = parseSummaryInput(body);
  if (!input) return json({ error: "invalid-payload" }, 400);

  const apiUrl = Deno.env.get("LLM_API_URL");
  const apiKey = Deno.env.get("LLM_API_KEY");
  const model = Deno.env.get("LLM_MODEL");
  if (!apiUrl || !apiKey || !model) return unavailable("not-configured");

  try {
    const { system, user: prompt } = buildPrompt(input);
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 320,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) return unavailable("provider-error");

    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.trim().length === 0) return unavailable("empty");

    const text = content.trim();
    if (!isSafeExplanation(text, input)) return unavailable("unsafe-numbers");

    return json({ text, promptVersion: EXPLAIN_PROMPT_VERSION });
  } catch {
    return unavailable("unavailable");
  }
});
