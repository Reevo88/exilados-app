-- ExiladosApp - etapa preparatória sem remoção de policies.
-- Execute antes de publicar o frontend que usa as novas views.

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
  ativo
from public.jogadores;

revoke all on table public.jogadores_publicos from public, anon;
grant select on table public.jogadores_publicos to authenticated;

create or replace view public.configuracao_app_publica
with (security_barrier = true)
as
select id, valor_churras
from public.configuracoes_financeiras;

revoke all on table public.configuracao_app_publica from public, anon;
grant select on table public.configuracao_app_publica to authenticated;

commit;
