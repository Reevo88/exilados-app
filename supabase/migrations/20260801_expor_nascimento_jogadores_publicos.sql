-- ExiladosApp - expõe data_nascimento em jogadores_publicos.
--
-- Motivo: a coroa de aniversariante (isAniversarianteMes) e a idade no card
-- dos Exilados dependem de data_nascimento, que a view não projetava. Sem o
-- campo o badge nunca aparecia em nenhuma tela (Exilados, Confirmações,
-- Escalações, Resumo pós-jogo) e a idade ficava sempre vazia.
--
-- A coluna entra no FIM da lista para que `create or replace view` funcione
-- sem drop (Postgres só permite acrescentar colunas ao final).
--
-- Continuam fora da view: email, telefone, auth_user_id e perfil_app.

begin;

create or replace view public.jogadores_publicos
with (security_barrier = true)
as
select
  id,
  nome,
  apelido,
  instagram,
  foto_url,
  posicao_favorita,
  modalidade,
  ativo,
  data_nascimento
from public.jogadores;

revoke all on table public.jogadores_publicos from public, anon;
grant select on table public.jogadores_publicos to authenticated;

commit;
