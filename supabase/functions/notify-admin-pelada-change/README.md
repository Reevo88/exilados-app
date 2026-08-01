## notify-admin-pelada-change

Edge Function para avisar os ADMs por e-mail quando uma mudanca em pelada aberta
termina em um estado final relevante:

- `confirmado` -> Nova inscricao
- `espera` -> Lista de espera
- `nao_vai` com `previous_status=confirmado|espera` -> Desistencia
- `nao_vai` com `previous_status=new` ou vazio -> Ausencia informada
- `confirmado` com `churras=churras` -> Confirmacao so churrasco
- `confirmado` com `churras=jogo_churras` -> Nova inscricao identificada como jogo + churrasco

### Variaveis de ambiente

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `RESEND_REPLY_TO`
- `ADMIN_NOTIFY_TO`

### Payload esperado

```json
{
  "event": "signup",
  "pelada_id": "uuid-da-pelada",
  "confirmacao_id": "uuid-da-confirmacao",
  "previous_status": "confirmado",
  "had_previous_confirmation": true
}
```
