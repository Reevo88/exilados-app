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

const jsonHeaders = { "Content-Type": "application/json" };

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

function resolveNotificationForState(event: string, status: string) {
  if (event === "signup" && status === "confirmado") {
    return { kind: "signup", actionLabel: "Inscreveu-se", subjectPrefix: "Nova inscricao" };
  }
  if (event === "signup" && status === "espera") {
    return {
      kind: "waitlist",
      actionLabel: "Entrou na lista de espera",
      subjectPrefix: "Lista de espera",
    };
  }
  if (event === "withdraw" && status === "nao_vai") {
    return { kind: "withdraw", actionLabel: "Desistiu", subjectPrefix: "Desistencia" };
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return response(405, { ok: false, error: "method_not_allowed" });
  if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
    return response(500, { ok: false, error: "missing_env" });
  }

  let payload: { event?: string; pelada_id?: string; confirmacao_id?: string };
  try {
    payload = await req.json();
  } catch (_) {
    return response(400, { ok: false, error: "invalid_json" });
  }

  const event = String(payload.event || "").trim();
  const peladaId = String(payload.pelada_id || "").trim();
  const confirmacaoId = String(payload.confirmacao_id || "").trim();
  if (!["signup", "withdraw"].includes(event) || !peladaId || !confirmacaoId) {
    return response(400, { ok: false, error: "invalid_payload" });
  }

  const { data: pelada, error: peladaError } = await sb
    .from("peladas")
    .select("id,nome,data,hora,status")
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

  const notification = resolveNotificationForState(event, confirmacao.status);
  if (!notification) {
    return response(200, {
      ok: true,
      sent: false,
      reason: "final_state_mismatch",
      final_status: confirmacao.status,
    });
  }

  const subject = `${notification.subjectPrefix} - ${pelada.nome}`;
  const text = [
    `Jogador: ${confirmacao.nome || "-"}`,
    `Acao: ${notification.actionLabel}`,
    `Pelada: ${pelada.nome || "-"}`,
    `Data da pelada: ${formatDate(pelada.data)}`,
    `Horario da pelada: ${pelada.hora ? String(pelada.hora).slice(0, 5) : "-"}`,
    `Horario do aviso: ${formatDateTime()}`,
  ].join("\n");

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
