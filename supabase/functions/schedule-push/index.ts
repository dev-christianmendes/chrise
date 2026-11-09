import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "OPTIONS, POST",
};

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return response({ error: "method-not-allowed" }, 405);

  const authorization = request.headers.get("Authorization");
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_ANON_KEY");
  if (!authorization || !url || !key) return response({ error: "unauthorized" }, 401);

  const supabase = createClient(url, key, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return response({ error: "unauthorized" }, 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return response({ error: "invalid-json" }, 400);
  }
  const reminders = body && typeof body === "object" && Array.isArray((body as Record<string, unknown>).reminders)
    ? (body as { reminders: unknown[] }).reminders
    : null;
  if (!reminders || reminders.length > 48) return response({ error: "invalid-reminders" }, 400);

  const rows = reminders.map((item) => {
    if (!item || typeof item !== "object") return null;
    const value = item as Record<string, unknown>;
    return {
      user_id: user.id,
      reminder_id: value.id,
      title: value.title,
      body: value.body,
      url: value.url,
      send_on: value.sendOn,
    };
  });
  if (rows.some((row) => !row || Object.values(row).some((value) => typeof value !== "string" || value.length === 0))) {
    return response({ error: "invalid-reminder" }, 400);
  }

  const { error: clearError } = await supabase.from("push_reminders").delete().eq("user_id", user.id).is("sent_at", null);
  if (clearError) return response({ error: "storage-error" }, 500);
  if (rows.length === 0) return response({ ok: true, scheduled: 0 });

  const { error } = await supabase.from("push_reminders").upsert(rows, { onConflict: "user_id,reminder_id" });
  return error ? response({ error: "storage-error" }, 500) : response({ ok: true, scheduled: rows.length });
});
