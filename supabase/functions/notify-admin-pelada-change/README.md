## notify-admin-pelada-change

Edge Function para avisar os ADMs por e-mail quando uma mudanca em pelada aberta
termina em um estado final relevante:

- `confirmado` -> Nova inscricao
- `espera` -> Lista de espera
- `nao_vai` -> Desistencia

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
  "confirmacao_id": "uuid-da-confirmacao"
}
```
