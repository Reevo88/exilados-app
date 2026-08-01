-- ExiladosApp - revogação global de sessões do Supabase Auth.
--
-- Efeito:
--   1. Revoga todas as sessões em todos os dispositivos.
--   2. Remove todos os refresh tokens, inclusive eventuais registros legados
--      sem session_id.
--   3. NÃO apaga usuários, identidades, senhas, perfis ou dados do aplicativo.
--
-- Limitação do JWT:
-- Tokens de acesso já emitidos são stateless e continuam válidos até o "exp".
-- Depois disso, a renovação falhará e um novo login será obrigatório.

begin;

-- Impede a criação concorrente de uma nova sessão durante os poucos
-- milissegundos da revogação global.
lock table auth.sessions, auth.refresh_tokens in access exclusive mode;

select
  (select count(*) from auth.sessions) as sessions_before,
  (select count(*) from auth.refresh_tokens) as refresh_tokens_before;

-- A exclusão de sessions normalmente remove refresh tokens vinculados por
-- cascade. A segunda exclusão cobre tokens antigos ou sem vínculo de sessão.
delete from auth.sessions;
delete from auth.refresh_tokens;

commit;

-- Resultado esperado: ambos iguais a zero.
select
  (select count(*) from auth.sessions) as sessions_after,
  (select count(*) from auth.refresh_tokens) as refresh_tokens_after;
