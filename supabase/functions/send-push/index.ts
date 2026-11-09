import {
  ApplicationServer,
  importVapidKeys,
  PushMessageError,
} from "jsr:@negrel/webpush@0.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const serviceUrl = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const cronSecret = Deno.env.get("PUSH_CRON_SECRET");

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!cronSecret || request.headers.get("x-push-cron-secret") !== cronSecret) return json({ error: "unauthorized" }, 401);
  if (!serviceUrl || !serviceKey) return json({ error: "misconfigured" }, 500);

  const vapidSubject = Deno.env.get("VAPID_SUBJECT");
  const vapidKeys = Deno.env.get("VAPID_KEYS");
  if (!vapidSubject || !vapidKeys) return json({ error: "vapid-not-configured" }, 500);

  let applicationServer: ApplicationServer;
  try {
    applicationServer = await ApplicationServer.new({
      contactInformation: vapidSubject,
      vapidKeys: await importVapidKeys(JSON.parse(vapidKeys)),
    });
  } catch {
    return json({ error: "vapid-not-configured" }, 500);
  }

  const supabase = createClient(serviceUrl, serviceKey);
  const today = new Date().toISOString().slice(0, 10);
  const { data: reminders, error: reminderError } = await supabase
    .from("push_reminders")
    .select("id,user_id,reminder_id,title,body,url")
    .is("sent_at", null)
    .lte("send_on", today)
    .limit(48);
  if (reminderError) return json({ error: "reminders-read-failed" }, 500);

  let sent = 0;
  let disabled = 0;
  for (const reminder of reminders ?? []) {
    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("id,endpoint,p256dh,auth")
      .eq("user_id", reminder.user_id)
      .eq("enabled", true);
    let delivered = false;
    for (const subscription of subscriptions ?? []) {
      try {
        await applicationServer.subscribe({
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        }).pushTextMessage(
          JSON.stringify({ title: reminder.title, body: reminder.body, url: reminder.url }),
          { urgency: "high", ttl: 86400 },
        );
        delivered = true;
        sent += 1;
      } catch (error) {
        const statusCode = error instanceof PushMessageError ? error.response.status : undefined;
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from("push_subscriptions").update({ enabled: false }).eq("id", subscription.id);
          disabled += 1;
        }
      }
    }
    if (delivered || (subscriptions ?? []).length === 0) {
      await supabase.from("push_reminders").update({ sent_at: new Date().toISOString() }).eq("id", reminder.id);
    }
  }
  return json({ ok: true, sent, disabled, reminders: reminders?.length ?? 0 });
});
