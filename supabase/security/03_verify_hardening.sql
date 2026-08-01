-- ExiladosApp - verificação conclusiva após 01_strict_owner_rls.sql.
-- Em caso de qualquer desvio, o bloco lança uma exceção.

do $$
declare
  r record;
  invalid_count bigint;
begin
  -- Todas as tabelas public devem ter RLS e FORCE RLS.
  select count(*) into invalid_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and (not c.relrowsecurity or not c.relforcerowsecurity);

  if invalid_count > 0 then
    raise exception 'Falha: % tabelas public sem RLS/FORCE RLS', invalid_count;
  end if;

  -- owner_id deve existir como UUID NOT NULL em toda tabela-base public.
  select count(*) into invalid_count
  from information_schema.tables t
  left join information_schema.columns c
    on c.table_schema = t.table_schema
   and c.table_name = t.table_name
   and c.column_name = 'owner_id'
  where t.table_schema = 'public'
    and t.table_type = 'BASE TABLE'
    and (c.column_name is null or c.data_type <> 'uuid' or c.is_nullable = 'YES');

  if invalid_count > 0 then
    raise exception 'Falha: % tabelas public com owner_id ausente/inválido', invalid_count;
  end if;

  -- Nenhuma policy de public pode alcançar anon/PUBLIC.
  select count(*) into invalid_count
  from pg_policies
  where schemaname = 'public'
    and ('anon' = any(roles) or 'public' = any(roles));

  if invalid_count > 0 then
    raise exception 'Falha: % policies public ainda alcançam anon/PUBLIC', invalid_count;
  end if;

  -- Confere a matriz mínima de policies esperadas.
  with expected(table_name, policy_name, command_name) as (
    values
      ('peladas','authenticated_read','SELECT'), ('peladas','admin_all','ALL'),
      ('resultados_pelada','authenticated_read','SELECT'), ('resultados_pelada','admin_all','ALL'),
      ('gols_pelada','authenticated_read','SELECT'), ('gols_pelada','admin_all','ALL'),
      ('videos_pelada','authenticated_read','SELECT'), ('videos_pelada','admin_all','ALL'),
      ('estatisticas_pelada','authenticated_read','SELECT'), ('estatisticas_pelada','admin_all','ALL'),
      ('caixa_movimentos','admin_all','ALL'),
      ('configuracoes_financeiras','admin_all','ALL'),
      ('jogadores','owner_select','SELECT'), ('jogadores','owner_insert','INSERT'),
      ('jogadores','owner_update','UPDATE'), ('jogadores','claim_select','SELECT'),
      ('jogadores','claim_update','UPDATE'), ('jogadores','admin_delete','DELETE'),
      ('confirmacoes','authenticated_read','SELECT'), ('confirmacoes','owner_insert','INSERT'),
      ('confirmacoes','owner_update','UPDATE'), ('confirmacoes','owner_delete','DELETE'),
      ('votos_pelada','authenticated_read','SELECT'), ('votos_pelada','owner_insert','INSERT'),
      ('votos_pelada','admin_update','UPDATE'), ('votos_pelada','admin_delete','DELETE'),
      ('push_subscriptions','owner_select','SELECT'), ('push_subscriptions','owner_insert','INSERT'),
      ('push_subscriptions','owner_update','UPDATE'), ('push_subscriptions','owner_delete','DELETE')
  )
  select count(*) into invalid_count
  from expected e
  where not exists (
    select 1
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = e.table_name
      and p.policyname = e.policy_name
      and p.cmd = e.command_name
      and p.roles = array['authenticated']::name[]
  );

  if invalid_count > 0 then
    raise exception 'Falha: % policies esperadas estão ausentes/divergentes', invalid_count;
  end if;

  -- Roles da API não podem criar objetos no schema public.
  if has_schema_privilege('anon', 'public', 'CREATE')
    or has_schema_privilege('authenticated', 'public', 'CREATE') then
    raise exception 'Falha: role da API ainda possui CREATE no schema public';
  end if;

  -- Views seguras devem existir, sem privilégio de leitura para anon.
  if to_regclass('public.jogadores_publicos') is null
    or to_regclass('public.configuracao_app_publica') is null then
    raise exception 'Falha: views autenticadas não encontradas';
  end if;

  if has_table_privilege('anon', 'public.jogadores_publicos', 'SELECT')
    or has_table_privilege('anon', 'public.configuracao_app_publica', 'SELECT') then
    raise exception 'Falha: anon ainda consegue ler uma view autenticada';
  end if;

  if not has_table_privilege('authenticated', 'public.jogadores_publicos', 'SELECT')
    or not has_table_privilege('authenticated', 'public.configuracao_app_publica', 'SELECT') then
    raise exception 'Falha: authenticated não consegue ler uma view necessária';
  end if;

  -- Nenhuma linha pode ficar sem proprietário válido.
  for r in
    select table_schema, table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_type = 'BASE TABLE'
  loop
    execute format(
      'select count(*) from %I.%I t '
      'where t.owner_id is null or not exists (select 1 from auth.users u where u.id = t.owner_id)',
      r.table_schema, r.table_name
    ) into invalid_count;

    if invalid_count > 0 then
      raise exception 'Falha: %.% possui % proprietários inválidos',
        r.table_schema, r.table_name, invalid_count;
    end if;
  end loop;
end
$$;

select
  'HARDENING PUBLIC VALIDADO' as status,
  (select count(*)
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r','p')) as protected_tables,
  (select count(*) from pg_policies where schemaname = 'public') as active_policies,
  public.is_app_admin() as current_session_is_admin,
  public.is_app_escalador() as current_session_is_escalador;

-- Apenas informativo: esses buckets permanecem pendentes até o script 02.
select id, public as still_public_pending_storage_hardening
from storage.buckets
where id in ('jogador-fotos', 'melhores-momentos')
order by id;
