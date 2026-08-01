import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sb = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return new Response(pageHtml("Link inválido", "Este link de descadastro é inválido."), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  let email: string;
  try {
    email = atob(token);
  } catch {
    return new Response(pageHtml("Link inválido", "Este link de descadastro é inválido."), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // Busca o usuário pelo email
  const { data: users, error } = await sb.auth.admin.listUsers();
  if (error) {
    return new Response(pageHtml("Erro", "Não foi possível processar sua solicitação."), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const user = users.users.find((u) => u.email === email);
  if (!user) {
    return new Response(pageHtml("Não encontrado", "Nenhuma conta encontrada com este e-mail."), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // Salva opt-out em user_metadata
  await sb.auth.admin.updateUserById(user.id, {
    user_metadata: { ...user.user_metadata, email_notifications: false },
  });

  return new Response(
    pageHtml("Descadastrado com sucesso", `O e-mail <strong>${email}</strong> foi removido das notificações de pelada.`),
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
});

function pageHtml(title: string, message: string) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title} — Exilados da Bola</title>
<style>
  body{margin:0;padding:40px 20px;background:#0a0a0a;color:#fff;font-family:Arial,Helvetica,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;box-sizing:border-box;}
  img{max-width:180px;margin-bottom:24px;}
  h1{font-size:22px;margin:0 0 12px;color:#F5E400;}
  p{font-size:15px;color:rgba(255,255,255,.75);text-align:center;max-width:360px;line-height:1.6;}
</style>
</head>
<body>
  <img src="https://exiladosdabola.com/boi-mono.png" alt="Exilados da Bola"/>
  <h1>${title}</h1>
  <p>${message}</p>
</body>
</html>`;
}
