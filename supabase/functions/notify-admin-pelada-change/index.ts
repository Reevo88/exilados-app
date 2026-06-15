import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";
const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "avisos@email.exiladosdabola.com";
const replyToEmail = Deno.env.get("RESEND_REPLY_TO") || "exiladosdabola@gmail.com";
const adminNotifyToRaw =
  Deno.env.get("ADMIN_NOTIFY_TO") || "mr.guima@gmail.com,luizfelipegarcia25@gmail.com";

const adminNotifyTo = adminNotifyToRaw
  .split(",")
  .map((email) => email.trim())
  .filter(Boolean);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonHeaders = {
  "Content-Type": "application/json",
  ...corsHeaders,
};

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
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${dateIso}T12:00:00`));
}

function formatDateTime(date = new Date()) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function resolveNotificationForState(event: string, status: string, previousStatus = "") {
  if (event === "signup" && status === "confirmado") {
    return {
      kind: "signup",
      actionLabel: "Inscreveu-se",
      subjectPrefix: "Nova inscricao",
      badgeLabel: "Confirmado",
      accentColor: "#188038",
    };
  }
  if (event === "signup" && status === "espera") {
    return {
      kind: "waitlist",
      actionLabel: "Entrou na lista de espera",
      subjectPrefix: "Lista de espera",
      badgeLabel: "Lista de espera",
      accentColor: "#b06000",
    };
  }
  if (event === "withdraw" && status === "nao_vai") {
    const saiuDeListaAtiva = ["confirmado", "espera"].includes(previousStatus);
    return {
      kind: saiuDeListaAtiva ? "withdraw" : "absence",
      actionLabel: saiuDeListaAtiva ? "Desistiu" : "Avisou que nao vai",
      subjectPrefix: saiuDeListaAtiva ? "Desistencia" : "Ausencia informada",
      badgeLabel: saiuDeListaAtiva ? "Desistencia" : "Nao vai",
      accentColor: "#b42318",
    };
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return response(405, { ok: false, error: "method_not_allowed" });
  if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
    return response(500, { ok: false, error: "missing_env" });
  }

  let payload: {
    event?: string;
    pelada_id?: string;
    confirmacao_id?: string;
    previous_status?: string;
  };
  try {
    payload = await req.json();
  } catch (_) {
    return response(400, { ok: false, error: "invalid_json" });
  }

  const event = String(payload.event || "").trim();
  const peladaId = String(payload.pelada_id || "").trim();
  const confirmacaoId = String(payload.confirmacao_id || "").trim();
  const previousStatus = String(payload.previous_status || "").trim();
  if (!["signup", "withdraw"].includes(event) || !peladaId || !confirmacaoId) {
    return response(400, { ok: false, error: "invalid_payload" });
  }

  const { data: pelada, error: peladaError } = await sb
    .from("peladas")
    .select("id,nome,data,hora,local,status")
    .eq("id", peladaId)
    .limit(1)
    .maybeSingle();
  if (peladaError) return response(500, { ok: false, error: "pelada_query_failed" });
  if (!pelada) return response(404, { ok: false, error: "pelada_not_found" });
  if (pelada.status !== "aberta") {
    return response(200, { ok: true, sent: false, reason: "pelada_not_open" });
  }

  const { data: confirmacao, error: confirmacaoError } = await sb
    .from("confirmacoes")
    .select("id,nome,status,created_at")
    .eq("id", confirmacaoId)
    .eq("pelada_id", peladaId)
    .limit(1)
    .maybeSingle();
  if (confirmacaoError) return response(500, { ok: false, error: "confirmacao_query_failed" });
  if (!confirmacao) return response(404, { ok: false, error: "confirmacao_not_found" });

  const notification = resolveNotificationForState(event, confirmacao.status, previousStatus);
  if (!notification) {
    return response(200, {
      ok: true,
      sent: false,
      reason: "final_state_mismatch",
      final_status: confirmacao.status,
    });
  }

  const { count: statusCount } = await sb
    .from("confirmacoes")
    .select("id", { count: "exact", head: true })
    .eq("pelada_id", peladaId)
    .eq("status", confirmacao.status);

  const subject = `${notification.subjectPrefix}: ${confirmacao.nome || "Jogador"} - ${pelada.nome}`;
  const horarioPelada = pelada.hora ? String(pelada.hora).slice(0, 5) : "-";
  const dataPelada = formatDate(pelada.data);
  const localPelada = pelada.local || "-";
  const horarioAviso = formatDateTime();
  const statusCountLabel = Number.isFinite(statusCount) ? String(statusCount) : "-";
  const text = [
    `Jogador: ${confirmacao.nome || "-"}`,
    `Acao: ${notification.actionLabel}`,
    `Pelada: ${pelada.nome || "-"}`,
    `Status anterior: ${previousStatus || "-"}`,
    `Status final: ${notification.badgeLabel}`,
    `Data da pelada: ${dataPelada}`,
    `Horario da pelada: ${horarioPelada}`,
    `Local: ${localPelada}`,
    `Total nesse status: ${statusCountLabel}`,
    `Horario do aviso: ${horarioAviso}`,
  ].join("\n");
  const html = `
    <div style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e5e7eb;">
        <div style="padding:20px 24px;background:${notification.accentColor};color:#ffffff;">
          <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.9;">Exilados da Bola</div>
          <h1 style="margin:8px 0 0;font-size:24px;line-height:1.2;">${escapeHtml(notification.subjectPrefix)}</h1>
        </div>
        <div style="padding:24px;">
          <p style="margin:0 0 14px;font-size:16px;line-height:1.5;">
            <strong>${escapeHtml(confirmacao.nome || "Jogador")}</strong> ${escapeHtml(notification.actionLabel.toLowerCase())} na pelada
            <strong>${escapeHtml(pelada.nome || "-")}</strong>.
          </p>
          <div style="display:inline-block;padding:7px 12px;border-radius:999px;background:#f3f4f6;color:${notification.accentColor};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;">
            ${escapeHtml(notification.badgeLabel)}
          </div>
          <div style="margin-top:18px;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <tr>
                <td style="padding:12px 14px;background:#f9fafb;color:#6b7280;width:38%;">Pelada</td>
                <td style="padding:12px 14px;">${escapeHtml(pelada.nome || "-")}</td>
              </tr>
              <tr>
                <td style="padding:12px 14px;background:#f9fafb;color:#6b7280;">Data</td>
                <td style="padding:12px 14px;">${escapeHtml(dataPelada)}</td>
              </tr>
              <tr>
                <td style="padding:12px 14px;background:#f9fafb;color:#6b7280;">Horario</td>
                <td style="padding:12px 14px;">${escapeHtml(horarioPelada)}</td>
              </tr>
              <tr>
                <td style="padding:12px 14px;background:#f9fafb;color:#6b7280;">Local</td>
                <td style="padding:12px 14px;">${escapeHtml(localPelada)}</td>
              </tr>
              <tr>
                <td style="padding:12px 14px;background:#f9fafb;color:#6b7280;">Status anterior</td>
                <td style="padding:12px 14px;">${escapeHtml(previousStatus || "-")}</td>
              </tr>
              <tr>
                <td style="padding:12px 14px;background:#f9fafb;color:#6b7280;">Total nesse status</td>
                <td style="padding:12px 14px;">${escapeHtml(statusCountLabel)}</td>
              </tr>
              <tr>
                <td style="padding:12px 14px;background:#f9fafb;color:#6b7280;">Aviso gerado</td>
                <td style="padding:12px 14px;">${escapeHtml(horarioAviso)}</td>
              </tr>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      ...jsonHeaders,
      Authorization: `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify({
      from: fromEmail,
      to: adminNotifyTo,
      reply_to: replyToEmail,
      subject,
      text,
      html,
    }),
  });

  if (!resendResponse.ok) {
    return response(502, {
      ok: false,
      error: "email_send_failed",
      details: await resendResponse.text(),
    });
  }

  const resendJson = await resendResponse.json();
  return response(200, {
    ok: true,
    sent: true,
    kind: notification.kind,
    email_id: resendJson?.id || null,
  });
});
