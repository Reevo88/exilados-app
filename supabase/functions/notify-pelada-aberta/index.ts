import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl     = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const resendApiKey    = Deno.env.get("RESEND_API_KEY") || "";
const fromEmail       = Deno.env.get("RESEND_FROM_EMAIL") || "avisos@email.exiladosdabola.com";
const replyToEmail    = Deno.env.get("RESEND_REPLY_TO") || "exiladosdabola@gmail.com";
const APP_URL         = "https://exiladosdabola.com";
const UNSUBSCRIBE_FN  = `${supabaseUrl}/functions/v1/email-unsubscribe`;
const SEND_PUSH_FN    = `${supabaseUrl}/functions/v1/send-push`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonHeaders = { "Content-Type": "application/json", ...corsHeaders };

const sb = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function formatDate(dateIso?: string | null) {
  if (!dateIso) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit", year: "numeric",
  }).format(new Date(`${dateIso}T12:00:00`));
}

function buildHtml(pelada: Record<string, unknown>, confirmUrl: string, unsubUrl: string) {
  const nome  = String(pelada.nome  || "-");
  const data  = formatDate(String(pelada.data || ""));
  const hora  = String(pelada.hora  || "-").slice(0, 5);
  const local = String(pelada.local || "-");

  return `
<div style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e5e7eb;">

    <!-- Header -->
    <div style="padding:20px 24px;background:#0a0a0a;color:#ffffff;">
      <div style="text-align:center;">
        <img src="${APP_URL}/boi-mono.png" alt="Exilados da Bola" style="width:56px;height:56px;object-fit:contain;display:block;margin:0 auto 10px;"/>
        <img src="${APP_URL}/logo-exilados.png" alt="ExiladosApp" style="height:36px;object-fit:contain;display:block;margin:0 auto 16px;"/>
        <h1 style="margin:0;font-size:24px;line-height:1.2;color:#F5E400;">Nova pelada aberta!</h1>
      </div>
    </div>

    <!-- Body -->
    <div style="padding:24px;">
      <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#111827;">
        A pelada <strong>${nome}</strong> está aberta para confirmações.<br/>
        Acesse o app e garanta sua vaga!
      </p>

      <!-- Info -->
      <div style="margin-bottom:20px;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr>
            <td style="padding:12px 14px;background:#f9fafb;color:#6b7280;width:38%;">Pelada</td>
            <td style="padding:12px 14px;">${nome}</td>
          </tr>
          <tr>
            <td style="padding:12px 14px;background:#f9fafb;color:#6b7280;">Data</td>
            <td style="padding:12px 14px;">${data}</td>
          </tr>
          <tr>
            <td style="padding:12px 14px;background:#f9fafb;color:#6b7280;">Horário</td>
            <td style="padding:12px 14px;">${hora}</td>
          </tr>
          <tr>
            <td style="padding:12px 14px;background:#f9fafb;color:#6b7280;">Local</td>
            <td style="padding:12px 14px;">${local}</td>
          </tr>
        </table>
      </div>

      <!-- CTA -->
      <div style="text-align:center;margin:24px 0;">
        <a href="${confirmUrl}" style="display:inline-flex;align-items:center;gap:8px;padding:14px 32px;background:#F5E400;color:#0a0a0a;font-size:16px;font-weight:700;text-decoration:none;border-radius:12px;letter-spacing:.02em;">
          <img src="${APP_URL}/bola-icon.png" alt="" style="width:22px;height:22px;object-fit:contain;flex-shrink:0;"/> Confirmar presença
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding:16px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
      <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
        Você está recebendo este e-mail por ser atleta cadastrado nos Exilados da Bola.<br/>
        <a href="${unsubUrl}" style="color:#6b7280;text-decoration:underline;">Descadastrar-se das notificações</a>
      </p>
    </div>

  </div>
</div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return response(405, { ok: false, error: "method_not_allowed" });
  if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
    return response(500, { ok: false, error: "missing_env" });
  }

  let payload: { pelada_id?: string };
  try { payload = await req.json(); }
  catch { return response(400, { ok: false, error: "invalid_json" }); }

  const peladaId = String(payload.pelada_id || "").trim();
  if (!peladaId) return response(400, { ok: false, error: "missing_pelada_id" });

  // Busca dados da pelada
  const { data: pelada, error: peladaError } = await sb
    .from("peladas")
    .select("id,nome,data,hora,local,status")
    .eq("id", peladaId)
    .maybeSingle();
  if (peladaError) return response(500, { ok: false, error: "pelada_query_failed" });
  if (!pelada)     return response(404, { ok: false, error: "pelada_not_found" });

  // Busca todos os usuários com email_notifications != false
  const { data: usersPage, error: usersError } = await sb.auth.admin.listUsers({ perPage: 1000 });
  if (usersError) return response(500, { ok: false, error: "users_query_failed" });

  const destinatarios = usersPage.users
    .filter((u) => u.email && u.user_metadata?.email_notifications !== false)
    .map((u) => u.email as string);

  if (!destinatarios.length) {
    return response(200, { ok: true, sent: false, reason: "no_recipients" });
  }

  const confirmUrl = `${APP_URL}?p=${encodeURIComponent(peladaId)}`;
  const subject    = `⚽ ${pelada.nome} — confirme sua presença!`;

  // Envia em lotes de 8 (abaixo do limite de 10 req/s do Resend)
  const BATCH = 8;
  let totalSent = 0;
  for (let i = 0; i < destinatarios.length; i += BATCH) {
    const lote = destinatarios.slice(i, i + BATCH);

    // Email individualizado por destinatário para ter link de unsubscribe personalizado
    await Promise.all(lote.map(async (email) => {
      const token     = btoa(email);
      const unsubUrl  = `${UNSUBSCRIBE_FN}?token=${token}`;
      const html      = buildHtml(pelada, confirmUrl, unsubUrl);

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendApiKey}` },
        body: JSON.stringify({ from: fromEmail, to: [email], reply_to: replyToEmail, subject, html }),
      });
      if (res.ok) totalSent++;
    }));

    // Pausa entre lotes para não estourar o rate limit do Resend
    if (i + BATCH < destinatarios.length) await new Promise(r => setTimeout(r, 1200));
  }

  // Dispara push para todos os dispositivos cadastrados
  const pushBody = `${pelada.nome} — ${formatDate(String(pelada.data || ""))} às ${String(pelada.hora || "").slice(0, 5)}`;
  fetch(SEND_PUSH_FN, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
    body: JSON.stringify({
      title: "⚽ Pelada aberta!",
      body:  pushBody,
      url:   `${APP_URL}?p=${encodeURIComponent(peladaId)}`,
    }),
  }).catch(() => {});

  return response(200, { ok: true, sent: true, total: totalSent });
});
