import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "OPTIONS, POST",
};

const response = (body: unknown, status = 200) =>
  new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function client(request: Request) {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_ANON_KEY");
  const authorization = request.headers.get("Authorization");
  if (!url || !key || !authorization) return null;
  return createClient(url, key, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return response({ error: "method-not-allowed" }, 405);

  const supabase = client(request);
  if (!supabase) return response({ error: "unauthorized" }, 401);
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return response({ error: "unauthorized" }, 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return response({ error: "invalid-json" }, 400);
  }

  if (!body || typeof body !== "object") return response({ error: "invalid-payload" }, 400);
  const input = body as Record<string, unknown>;
  const endpoint = input.endpoint;
  if (typeof endpoint !== "string" || !endpoint.startsWith("https://") || endpoint.length > 2048) {
    return response({ error: "invalid-endpoint" }, 400);
  }

  if (input.action === "remove") {
    const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", user.id);
    return error ? response({ error: "storage-error" }, 500) : response(null, 204);
  }

  const keys = input.keys;
  if (!keys || typeof keys !== "object") return response({ error: "invalid-keys" }, 400);
  const p256dh = (keys as Record<string, unknown>).p256dh;
  const auth = (keys as Record<string, unknown>).auth;
  if (typeof p256dh !== "string" || typeof auth !== "string" || p256dh.length > 512 || auth.length > 512) {
    return response({ error: "invalid-keys" }, 400);
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    { user_id: user.id, endpoint, p256dh, auth, enabled: true, updated_at: new Date().toISOString() },
    { onConflict: "endpoint" },
  );
  return error ? response({ error: "storage-error" }, 500) : response({ ok: true });
});
