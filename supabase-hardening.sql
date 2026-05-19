-- Exilados da Bola - Supabase hardening
-- Rode no Supabase SQL Editor depois de revisar os nomes das tabelas/colunas.
-- Este script assume que os usuarios ADM fazem login pelo Supabase Auth com os e-mails abaixo.

begin;

create extension if not exists pgcrypto;

create or replace function public.exilados_user_email()
returns text
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create or replace function public.exilados_is_full_admin()
returns boolean
language sql
stable
as $$
  select public.exilados_user_email() in (
    'mr.guima@gmail.com',
    'luizfelipegarcia25@gmail.com'
  );
$$;

create or replace function public.exilados_is_escalador()
returns boolean
language sql
stable
as $$
  select public.exilados_user_email() = 'tarcisiobregao@gmail.com';
$$;

create or replace function public.exilados_is_admin()
returns boolean
language sql
stable
as $$
  select public.exilados_is_full_admin() or public.exilados_is_escalador();
$$;

create or replace function public.exilados_norm_nome(nome text)
returns text
language sql
immutable
as $$
  select lower(trim(regexp_replace(coalesce(nome,''), '\s+', ' ', 'g')));
$$;

alter table if exists public.peladas enable row level security;
alter table if exists public.confirmacoes enable row level security;
alter table if exists public.configuracoes_financeiras enable row level security;
alter table if exists public.caixa_movimentos enable row level security;
alter table if exists public.resultados_pelada enable row level security;
alter table if exists public.gols_pelada enable row level security;
alter table if exists public.videos_pelada enable row level security;
alter table if exists public.estatisticas_pelada enable row level security;
alter table if exists public.votos_pelada enable row level security;

-- Publico pode ler o que o app exibe.
drop policy if exists "public read peladas" on public.peladas;
create policy "public read peladas" on public.peladas for select to anon, authenticated using (true);

drop policy if exists "public read confirmacoes" on public.confirmacoes;
create policy "public read confirmacoes" on public.confirmacoes for select to anon, authenticated using (true);

drop policy if exists "public read resultados" on public.resultados_pelada;
create policy "public read resultados" on public.resultados_pelada for select to anon, authenticated using (true);

drop policy if exists "public read gols" on public.gols_pelada;
create policy "public read gols" on public.gols_pelada for select to anon, authenticated using (true);

drop policy if exists "public read videos" on public.videos_pelada;
create policy "public read videos" on public.videos_pelada for select to anon, authenticated using (true);

drop policy if exists "public read estatisticas" on public.estatisticas_pelada;
create policy "public read estatisticas" on public.estatisticas_pelada for select to anon, authenticated using (true);

drop policy if exists "public read votos" on public.votos_pelada;
create policy "public read votos" on public.votos_pelada for select to anon, authenticated using (true);

drop policy if exists "public read config financeira" on public.configuracoes_financeiras;
create policy "public read config financeira" on public.configuracoes_financeiras for select to anon, authenticated using (true);

drop policy if exists "public read caixa" on public.caixa_movimentos;
create policy "public read caixa" on public.caixa_movimentos for select to anon, authenticated using (true);

-- Jogador publico: confirma presenca/ausencia e vota. Edicoes ficam para ADM.
drop policy if exists "public insert confirmacoes" on public.confirmacoes;
create policy "public insert confirmacoes" on public.confirmacoes for insert to anon, authenticated
with check (
  status in ('confirmado','nao_vai')
  and coalesce(nome,'') <> ''
  and coalesce(posicao,'?') in ('?','GOL','ZAG','LAT','MEI','ATA')
  and coalesce(time,'pool') in ('pool','azul','vermelho')
  and coalesce(modalidade,'avulso') in ('avulso','mensalista')
);

drop policy if exists "public insert votos" on public.votos_pelada;
create policy "public insert votos" on public.votos_pelada for insert to anon, authenticated
with check (
  nota between 1 and 5
  and coalesce(nome_votante,'') <> ''
  and coalesce(nome_votado,'') <> ''
);

-- Full admin: controle total.
drop policy if exists "full admin write peladas" on public.peladas;
create policy "full admin write peladas" on public.peladas for all to authenticated
using (public.exilados_is_full_admin())
with check (public.exilados_is_full_admin());

drop policy if exists "full admin write confirmacoes" on public.confirmacoes;
create policy "full admin write confirmacoes" on public.confirmacoes for all to authenticated
using (public.exilados_is_full_admin())
with check (public.exilados_is_full_admin());

drop policy if exists "full admin write financeiro config" on public.configuracoes_financeiras;
create policy "full admin write financeiro config" on public.configuracoes_financeiras for all to authenticated
using (public.exilados_is_full_admin())
with check (public.exilados_is_full_admin());

drop policy if exists "full admin write caixa" on public.caixa_movimentos;
create policy "full admin write caixa" on public.caixa_movimentos for all to authenticated
using (public.exilados_is_full_admin())
with check (public.exilados_is_full_admin());

drop policy if exists "full admin write resultados" on public.resultados_pelada;
create policy "full admin write resultados" on public.resultados_pelada for all to authenticated
using (public.exilados_is_full_admin())
with check (public.exilados_is_full_admin());

drop policy if exists "full admin write gols" on public.gols_pelada;
create policy "full admin write gols" on public.gols_pelada for all to authenticated
using (public.exilados_is_full_admin())
with check (public.exilados_is_full_admin());

drop policy if exists "full admin write videos" on public.videos_pelada;
create policy "full admin write videos" on public.videos_pelada for all to authenticated
using (public.exilados_is_full_admin())
with check (public.exilados_is_full_admin());

drop policy if exists "full admin write estatisticas" on public.estatisticas_pelada;
create policy "full admin write estatisticas" on public.estatisticas_pelada for all to authenticated
using (public.exilados_is_full_admin())
with check (public.exilados_is_full_admin());

-- Escalador: pode atualizar confirmacoes para montar times/posicoes, mas nao mexe no financeiro/pelada.
drop policy if exists "escalador update confirmacoes" on public.confirmacoes;
create policy "escalador update confirmacoes" on public.confirmacoes for update to authenticated
using (public.exilados_is_escalador())
with check (public.exilados_is_escalador());

-- Constraints defensivas. Se algum nome ja estiver duplicado, rode a limpeza antes dos unique indexes.
do $$
begin
  if to_regclass('public.peladas') is not null and not exists (select 1 from pg_constraint where conname = 'peladas_status_chk') then
    alter table public.peladas add constraint peladas_status_chk check (status in ('aberta','encerrada','fechada'));
  end if;

  if to_regclass('public.confirmacoes') is not null and not exists (select 1 from pg_constraint where conname = 'confirmacoes_status_chk') then
    alter table public.confirmacoes add constraint confirmacoes_status_chk check (status is null or status in ('confirmado','nao_vai'));
  end if;

  if to_regclass('public.confirmacoes') is not null and not exists (select 1 from pg_constraint where conname = 'confirmacoes_posicao_chk') then
    alter table public.confirmacoes add constraint confirmacoes_posicao_chk check (posicao is null or posicao in ('?','GOL','ZAG','LAT','MEI','ATA'));
  end if;

  if to_regclass('public.confirmacoes') is not null and not exists (select 1 from pg_constraint where conname = 'confirmacoes_time_chk') then
    alter table public.confirmacoes add constraint confirmacoes_time_chk check (time is null or time in ('pool','azul','vermelho'));
  end if;

  if to_regclass('public.confirmacoes') is not null and not exists (select 1 from pg_constraint where conname = 'confirmacoes_modalidade_chk') then
    alter table public.confirmacoes add constraint confirmacoes_modalidade_chk check (modalidade is null or modalidade in ('avulso','mensalista'));
  end if;

  if to_regclass('public.caixa_movimentos') is not null and not exists (select 1 from pg_constraint where conname = 'caixa_movimentos_tipo_chk') then
    alter table public.caixa_movimentos add constraint caixa_movimentos_tipo_chk check (tipo in ('entrada','saida','estorno'));
  end if;

  if to_regclass('public.votos_pelada') is not null and not exists (select 1 from pg_constraint where conname = 'votos_pelada_nota_chk') then
    alter table public.votos_pelada add constraint votos_pelada_nota_chk check (nota between 1 and 5);
  end if;
end $$;

create unique index if not exists uq_confirmacoes_nome_status_pelada
  on public.confirmacoes (pelada_id, public.exilados_norm_nome(nome), coalesce(status,'confirmado'));

create unique index if not exists uq_votos_pelada_votante_votado
  on public.votos_pelada (pelada_id, public.exilados_norm_nome(nome_votante), public.exilados_norm_nome(nome_votado));

create unique index if not exists uq_votos_pelada_ip_votado
  on public.votos_pelada (pelada_id, ip_votante, public.exilados_norm_nome(nome_votado))
  where ip_votante is not null;
create index if not exists idx_peladas_data_status on public.peladas (data desc, status);
create index if not exists idx_confirmacoes_pelada_ordem on public.confirmacoes (pelada_id, ordem, created_at);
create index if not exists idx_caixa_movimentos_data on public.caixa_movimentos (data, id);
create index if not exists idx_resultados_pelada on public.resultados_pelada (pelada_id);
create index if not exists idx_gols_pelada on public.gols_pelada (pelada_id, quantidade desc);
create index if not exists idx_videos_pelada on public.videos_pelada (pelada_id, ordem, created_at);
create index if not exists idx_estatisticas_pelada on public.estatisticas_pelada (pelada_id, tipo);
create index if not exists idx_votos_pelada on public.votos_pelada (pelada_id);

-- Storage: leitura publica do bucket melhores-momentos; upload/remocao apenas full admin.
drop policy if exists "public read melhores momentos" on storage.objects;
create policy "public read melhores momentos" on storage.objects for select to anon, authenticated
using (bucket_id = 'melhores-momentos');

drop policy if exists "full admin upload melhores momentos" on storage.objects;
create policy "full admin upload melhores momentos" on storage.objects for insert to authenticated
with check (bucket_id = 'melhores-momentos' and public.exilados_is_full_admin());

drop policy if exists "full admin delete melhores momentos" on storage.objects;
create policy "full admin delete melhores momentos" on storage.objects for delete to authenticated
using (bucket_id = 'melhores-momentos' and public.exilados_is_full_admin());

commit;
