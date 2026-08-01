-- A posição é obrigatória para quem está confirmado ou na espera.
-- NOT VALID preserva o histórico já inconsistente, mas bloqueia imediatamente
-- novos INSERTs/UPDATEs inválidos, sem inventar posições para registros antigos.
alter table public.confirmacoes
  drop constraint if exists confirmacoes_posicao_jogo_valida;

alter table public.confirmacoes
  add constraint confirmacoes_posicao_jogo_valida
  check (
    status not in ('confirmado', 'espera')
    or posicao in ('GOL', 'ZAG', 'LAT', 'MEI', 'ATA')
  ) not valid;
