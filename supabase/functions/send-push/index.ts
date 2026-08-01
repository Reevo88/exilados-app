import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.6";

const supabaseUrl    = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const vapidPublic    = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const vapidPrivate   = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const vapidEmail     = Deno.env.get("VAPID_EMAIL") || "mailto:exiladosdabola@gmail.com";
const APP_URL        = "https://exiladosdabola.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const sb = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

webpush.setVapidDetails(vapidEmail, vapidPublic, vapidPrivate);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let payload: { title?: string; body?: string; url?: string };
  try { payload = await req.json(); }
  catch { return new Response(JSON.stringify({ ok: false, error: "invalid_json" }), { status: 400 }); }

  const { title = "Exilados da Bola", body = "", url = APP_URL } = payload;

  const { data: subs, error } = await sb
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth");

  if (error) return new Response(JSON.stringify({ ok: false, error: "db_error" }), { status: 500 });
  if (!subs?.length) return new Response(JSON.stringify({ ok: true, sent: 0 }));

  let sent = 0;
  const mortas: string[] = [];

  await Promise.allSettled(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ title, body, url }),
      );
      sent++;
    } catch (e: any) {
      // Subscription expirada/inválida — remove do banco
      if (e.statusCode === 404 || e.statusCode === 410) mortas.push(s.endpoint);
    }
  }));

  // Limpa subscriptions mortas
  if (mortas.length) {
    await sb.from("push_subscriptions").delete().in("endpoint", mortas);
  }

  return new Response(JSON.stringify({ ok: true, sent, removed: mortas.length }), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
});
