-- ExiladosApp - hardening de todas as tabelas do schema public.
-- Esta versão aplica as alterações e termina com COMMIT.
-- MODELO: cada linha pertence a exatamente um auth.users.id em owner_id.
-- Usuário comum acessa somente suas linhas; adm/presidente podem gerir todas.
-- ATENCAO: este modelo elimina leitura/gravação anônima e dados compartilhados.
-- Execute primeiro 00_audit_rls.sql e faça backup.

begin;

-- Ajuste este e-mail para o usuário que deve receber linhas históricas sem dono.
-- A migration ABORTA se o e-mail não existir em auth.users.
create temporary table _hardening_config as
select id as legacy_owner_id
from auth.users
where lower(email) = lower('mr.guima@gmail.com')
limit 1;

do $$
begin
  if not exists (select 1 from _hardening_config) then
    raise exception
      'Hardening abortado: defina em 01_strict_owner_rls.sql um e-mail existente em auth.users para o legacy_owner_id';
  end if;
end
$$;

-- A autorização administrativa vive no banco e não confia em e-mail/estado do frontend.
-- SECURITY DEFINER evita recursão de RLS ao consultar a própria tabela jogadores.
create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select
    exists (
      select 1
      from public.jogadores j
      where j.auth_user_id = (select auth.uid())
        and j.perfil_app in ('adm', 'presidente')
    )
    or lower(coalesce((select auth.jwt()) ->> 'email', '')) = 'mr.guima@gmail.com';
$$;

revoke all on function public.is_app_admin() from public, anon;
grant execute on function public.is_app_admin() to authenticated, service_role;

-- Escalador conserva somente o acesso operacional às confirmações.
create or replace function public.is_app_escalador()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select exists (
    select 1
    from public.jogadores j
    where j.auth_user_id = (select auth.uid())
      and j.perfil_app = 'escalador'
  );
$$;

revoke all on function public.is_app_escalador() from public, anon;
grant execute on function public.is_app_escalador() to authenticated, service_role;

-- Função única para preencher o dono e impedir troca de propriedade pelo cliente.
create or replace function public.enforce_row_owner()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_trusted boolean := current_user in ('postgres', 'supabase_admin', 'service_role');
  v_admin boolean := public.is_app_admin();
  v_escalador boolean := public.is_app_escalador();
  v_email text := lower(coalesce((select auth.jwt()) ->> 'email', ''));
begin
  if tg_op = 'INSERT' then
    if v_uid is null then
      if not v_trusted then
        raise exception 'authentication required' using errcode = '42501';
      end if;
      if new.owner_id is null then
        raise exception 'trusted insert must provide owner_id' using errcode = '23502';
      end if;
      return new;
    end if;

    if new.owner_id is null then
      new.owner_id := v_uid;
    elsif new.owner_id <> v_uid and not v_admin then
      raise exception 'owner_id must equal auth.uid()' using errcode = '42501';
    end if;

    -- Um usuário comum nunca pode criar seu próprio perfil já elevado.
    if tg_table_schema = 'public' and tg_table_name = 'jogadores' and not v_admin then
      if new.auth_user_id is null then
        new.auth_user_id := v_uid;
      elsif new.auth_user_id <> v_uid then
        raise exception 'auth_user_id must equal auth.uid()' using errcode = '42501';
      end if;
      if coalesce(new.perfil_app, 'jogador') <> 'jogador' then
        raise exception 'only an admin can assign privileged profiles' using errcode = '42501';
      end if;
      new.perfil_app := 'jogador';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if v_trusted then
      return new;
    end if;

    -- Reivindicação única de cadastro pré-criado pelo ADM, vinculada ao e-mail
    -- assinado pelo Supabase Auth. O papel previamente definido não pode mudar.
    -- OLD/NEW são records polimórficos. Só acesse colunas exclusivas de
    -- jogadores dentro de um bloco já restrito a essa tabela; expressões AND
    -- não garantem short-circuit no PostgreSQL.
    if tg_table_schema = 'public' and tg_table_name = 'jogadores' and not v_admin then
      if old.auth_user_id is null
        and v_email <> ''
        and lower(coalesce(old.email, '')) = v_email
        and new.auth_user_id = v_uid then
        if new.perfil_app is distinct from old.perfil_app then
          raise exception 'perfil_app cannot change during profile claim' using errcode = '42501';
        end if;
        new.owner_id := v_uid;
        return new;
      end if;
    end if;

    if v_uid is null or (
      old.owner_id <> v_uid
      and not v_admin
      and not (tg_table_schema = 'public' and tg_table_name = 'confirmacoes' and v_escalador)
    ) then
      raise exception 'row is not owned by auth.uid()' using errcode = '42501';
    end if;
    if new.owner_id is distinct from old.owner_id then
      raise exception 'owner_id is immutable' using errcode = '42501';
    end if;
    -- Impede que um jogador promova a si mesmo ou associe seu perfil a outro login.
    if tg_table_schema = 'public' and tg_table_name = 'jogadores' and not v_admin then
      if new.perfil_app is distinct from old.perfil_app
        or new.auth_user_id is distinct from old.auth_user_id then
        raise exception 'only an admin can change perfil_app or auth_user_id' using errcode = '42501';
      end if;
    end if;
    return new;
  end if;

  return new;
end
$$;

revoke all on function public.enforce_row_owner() from public, anon, authenticated;

-- Adiciona owner_id, migra linhas antigas, remove policies existentes e cria CRUD por dono.
do $$
declare
  r record;
  p record;
  v_legacy_owner uuid := (select legacy_owner_id from _hardening_config limit 1);
  v_has_auth_user_id boolean;
  v_has_user_id boolean;
begin
  for r in
    select n.nspname as schema_name, c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and c.relname not like 'pg_%'
    order by c.relname
  loop
    execute format(
      'alter table %I.%I add column if not exists owner_id uuid',
      r.schema_name, r.table_name
    );

    if not exists (
      select 1
      from information_schema.columns
      where table_schema = r.schema_name
        and table_name = r.table_name
        and column_name = 'owner_id'
        and data_type = 'uuid'
    ) then
      raise exception 'Hardening abortado: %.owner_id existe mas não é UUID', r.table_name;
    end if;

    select exists (
      select 1 from information_schema.columns
      where table_schema = r.schema_name
        and table_name = r.table_name
        and column_name = 'auth_user_id'
        and data_type = 'uuid'
    ) into v_has_auth_user_id;

    select exists (
      select 1 from information_schema.columns
      where table_schema = r.schema_name
        and table_name = r.table_name
        and column_name = 'user_id'
        and data_type = 'uuid'
    ) into v_has_user_id;

    -- Recupera vínculos legados de jogadores pelo e-mail único do Supabase Auth.
    -- Isso evita que um ADM antigo fique sem perfil após o bloqueio da leitura anônima.
    if r.table_name = 'jogadores' and v_has_auth_user_id then
      execute
        'update public.jogadores j '
        'set auth_user_id = u.id, owner_id = u.id '
        'from auth.users u '
        'where j.auth_user_id is null '
        'and j.email is not null '
        'and lower(j.email) = lower(u.email)';
    end if;

    -- Confirmações pertencem ao login vinculado ao jogador, quando disponível.
    if r.table_name = 'confirmacoes' then
      execute
        'update public.confirmacoes c '
        'set owner_id = j.auth_user_id '
        'from public.jogadores j '
        'where c.owner_id is null '
        'and c.jogador_id = j.id '
        'and j.auth_user_id is not null '
        'and exists (select 1 from auth.users u where u.id = j.auth_user_id)';
    end if;

    -- Aproveita vínculo existente somente se ele aponta para auth.users.
    if v_has_auth_user_id then
      execute format(
        'update %I.%I t set owner_id = t.auth_user_id '
        'where t.owner_id is null and exists '
        '(select 1 from auth.users u where u.id = t.auth_user_id)',
        r.schema_name, r.table_name
      );
    end if;

    if v_has_user_id then
      execute format(
        'update %I.%I t set owner_id = t.user_id '
        'where t.owner_id is null and exists '
        '(select 1 from auth.users u where u.id = t.user_id)',
        r.schema_name, r.table_name
      );
    end if;

    -- Linhas históricas sem vínculo passam explicitamente ao proprietário legado.
    execute format(
      'update %I.%I set owner_id = $1 where owner_id is null',
      r.schema_name, r.table_name
    ) using v_legacy_owner;

    -- Impede owner inválido antes de criar FK/NOT NULL.
    execute format(
      'select count(*) from %I.%I t '
      'where t.owner_id is null or not exists (select 1 from auth.users u where u.id = t.owner_id)',
      r.schema_name, r.table_name
    ) into p;
    if p.count > 0 then
      raise exception 'Hardening abortado: %.% possui % owner_id inválidos',
        r.schema_name, r.table_name, p.count;
    end if;

    execute format(
      'alter table %I.%I alter column owner_id set not null',
      r.schema_name, r.table_name
    );

    if not exists (
      select 1
      from pg_constraint con
      join pg_class c on c.oid = con.conrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = r.schema_name
        and c.relname = r.table_name
        and con.conname = r.table_name || '_owner_id_fkey'
    ) then
      execute format(
        'alter table %I.%I add constraint %I foreign key (owner_id) references auth.users(id) on delete restrict',
        r.schema_name,
        r.table_name,
        r.table_name || '_owner_id_fkey'
      );
    end if;

    execute format(
      'create index if not exists %I on %I.%I (owner_id)',
      r.table_name || '_owner_id_idx', r.schema_name, r.table_name
    );

    execute format('alter table %I.%I enable row level security', r.schema_name, r.table_name);
    execute format('alter table %I.%I force row level security', r.schema_name, r.table_name);

    for p in
      select policyname
      from pg_policies
      where schemaname = r.schema_name
        and tablename = r.table_name
    loop
      execute format('drop policy %I on %I.%I', p.policyname, r.schema_name, r.table_name);
    end loop;

    execute format(
      'create policy owner_select on %I.%I for select to authenticated '
      'using ((select auth.uid()) = owner_id or (select public.is_app_admin()))',
      r.schema_name, r.table_name
    );
    execute format(
      'create policy owner_insert on %I.%I for insert to authenticated '
      'with check ((select auth.uid()) = owner_id or (select public.is_app_admin()))',
      r.schema_name, r.table_name
    );
    execute format(
      'create policy owner_update on %I.%I for update to authenticated '
      'using ((select auth.uid()) = owner_id or (select public.is_app_admin())) '
      'with check ((select auth.uid()) = owner_id or (select public.is_app_admin()))',
      r.schema_name, r.table_name
    );
    execute format(
      'create policy owner_delete on %I.%I for delete to authenticated '
      'using ((select auth.uid()) = owner_id or (select public.is_app_admin()))',
      r.schema_name, r.table_name
    );

    execute format('drop trigger if exists trg_enforce_row_owner on %I.%I', r.schema_name, r.table_name);
    execute format(
      'create trigger trg_enforce_row_owner before insert or update on %I.%I '
      'for each row execute function public.enforce_row_owner()',
      r.schema_name, r.table_name
    );

    execute format('revoke all on table %I.%I from anon', r.schema_name, r.table_name);
    execute format('revoke all on table %I.%I from public', r.schema_name, r.table_name);
    execute format(
      'grant select, insert, update, delete on table %I.%I to authenticated',
      r.schema_name, r.table_name
    );
  end loop;
end
$$;

-- Substitui o modelo genérico por uma matriz específica do aplicativo.
-- Leitura esportiva é compartilhada somente entre usuários autenticados.
-- Escrita administrativa e dados privados continuam restritos.
do $$
declare
  r record;
  p record;
begin
  for r in
    select *
    from (values
      ('peladas', 'shared_admin'),
      ('resultados_pelada', 'shared_admin'),
      ('gols_pelada', 'shared_admin'),
      ('videos_pelada', 'shared_admin'),
      ('estatisticas_pelada', 'shared_admin'),
      ('caixa_movimentos', 'admin_only'),
      ('configuracoes_financeiras', 'admin_only'),
      ('jogadores', 'players'),
      ('confirmacoes', 'confirmations'),
      ('votos_pelada', 'votes'),
      ('push_subscriptions', 'subscriptions')
    ) as policy_matrix(table_name, access_model)
  loop
    if to_regclass(format('public.%I', r.table_name)) is null then
      raise exception 'Tabela esperada não encontrada: public.%', r.table_name;
    end if;

    for p in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = r.table_name
    loop
      execute format('drop policy %I on public.%I', p.policyname, r.table_name);
    end loop;

    if r.access_model = 'shared_admin' then
      execute format(
        'create policy authenticated_read on public.%I for select to authenticated using (true)',
        r.table_name
      );
      execute format(
        'create policy admin_all on public.%I for all to authenticated '
        'using ((select public.is_app_admin())) '
        'with check ((select public.is_app_admin()))',
        r.table_name
      );

    elsif r.access_model = 'admin_only' then
      execute format(
        'create policy admin_all on public.%I for all to authenticated '
        'using ((select public.is_app_admin())) '
        'with check ((select public.is_app_admin()))',
        r.table_name
      );

    elsif r.access_model = 'players' then
      execute format(
        'create policy owner_select on public.%I for select to authenticated '
        'using ((select auth.uid()) = owner_id or (select public.is_app_admin()))',
        r.table_name
      );
      execute format(
        'create policy owner_insert on public.%I for insert to authenticated '
        'with check ((select auth.uid()) = owner_id or (select public.is_app_admin()))',
        r.table_name
      );
      execute format(
        'create policy owner_update on public.%I for update to authenticated '
        'using ((select auth.uid()) = owner_id or (select public.is_app_admin())) '
        'with check ((select auth.uid()) = owner_id or (select public.is_app_admin()))',
        r.table_name
      );
      execute format(
        'create policy claim_select on public.%I for select to authenticated '
        'using (auth_user_id is null and lower(email) = lower((select auth.jwt()) ->> ''email''))',
        r.table_name
      );
      execute format(
        'create policy claim_update on public.%I for update to authenticated '
        'using (auth_user_id is null and lower(email) = lower((select auth.jwt()) ->> ''email'')) '
        'with check (auth_user_id = (select auth.uid()) and owner_id = (select auth.uid()) '
        'and lower(email) = lower((select auth.jwt()) ->> ''email''))',
        r.table_name
      );
      execute format(
        'create policy admin_delete on public.%I for delete to authenticated '
        'using ((select public.is_app_admin()))',
        r.table_name
      );

    elsif r.access_model = 'confirmations' then
      execute format(
        'create policy authenticated_read on public.%I for select to authenticated using (true)',
        r.table_name
      );
      execute format(
        'create policy owner_insert on public.%I for insert to authenticated '
        'with check ((select auth.uid()) = owner_id or (select public.is_app_admin()))',
        r.table_name
      );
      execute format(
        'create policy owner_update on public.%I for update to authenticated '
        'using ((select auth.uid()) = owner_id or (select public.is_app_admin()) or (select public.is_app_escalador())) '
        'with check ((select auth.uid()) = owner_id or (select public.is_app_admin()) or (select public.is_app_escalador()))',
        r.table_name
      );
      execute format(
        'create policy owner_delete on public.%I for delete to authenticated '
        'using ((select auth.uid()) = owner_id or (select public.is_app_admin()))',
        r.table_name
      );

    elsif r.access_model = 'votes' then
      execute format(
        'create policy authenticated_read on public.%I for select to authenticated using (true)',
        r.table_name
      );
      execute format(
        'create policy owner_insert on public.%I for insert to authenticated '
        'with check ((select auth.uid()) = owner_id or (select public.is_app_admin()))',
        r.table_name
      );
      execute format(
        'create policy admin_update on public.%I for update to authenticated '
        'using ((select public.is_app_admin())) with check ((select public.is_app_admin()))',
        r.table_name
      );
      execute format(
        'create policy admin_delete on public.%I for delete to authenticated '
        'using ((select public.is_app_admin()))',
        r.table_name
      );

    elsif r.access_model = 'subscriptions' then
      execute format(
        'create policy owner_select on public.%I for select to authenticated using ((select auth.uid()) = owner_id)',
        r.table_name
      );
      execute format(
        'create policy owner_insert on public.%I for insert to authenticated with check ((select auth.uid()) = owner_id)',
        r.table_name
      );
      execute format(
        'create policy owner_update on public.%I for update to authenticated '
        'using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id)',
        r.table_name
      );
      execute format(
        'create policy owner_delete on public.%I for delete to authenticated using ((select auth.uid()) = owner_id)',
        r.table_name
      );
    end if;
  end loop;
end
$$;

-- Projeções compartilhadas deliberadamente limitadas a campos não sensíveis.
-- As views executam como o proprietário somente para atravessar o RLS da tabela-base;
-- não aceitam parâmetros e não expõem e-mail, telefone, auth_user_id ou perfil_app.
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

-- Views executam com os direitos do chamador e herdam RLS das tabelas-base.
do $$
declare
  r record;
begin
  for r in
    select schemaname, viewname
    from pg_views
    where schemaname = 'public'
      and viewname not in ('jogadores_publicos', 'configuracao_app_publica')
  loop
    execute format('alter view %I.%I set (security_invoker = true)', r.schemaname, r.viewname);
    execute format('revoke all on table %I.%I from anon, public', r.schemaname, r.viewname);
    execute format('grant select on table %I.%I to authenticated', r.schemaname, r.viewname);
  end loop;
end
$$;

-- Materialized views não suportam RLS: bloqueia acesso pela API.
do $$
declare
  r record;
begin
  for r in
    select schemaname, matviewname
    from pg_matviews
    where schemaname = 'public'
  loop
    execute format(
      'revoke all on table %I.%I from anon, authenticated, public',
      r.schemaname, r.matviewname
    );
  end loop;
end
$$;

grant usage on schema public to authenticated;
revoke create on schema public from public, anon, authenticated;
revoke all on all sequences in schema public from anon, public;
grant usage, select on all sequences in schema public to authenticated;

-- Nenhuma função public fica executável implicitamente pela API.
revoke execute on all functions in schema public from public, anon, authenticated;
-- Exceção mínima necessária às policies. A função não recebe parâmetros e usa auth.uid().
grant execute on function public.is_app_admin() to authenticated, service_role;
grant execute on function public.is_app_escalador() to authenticated, service_role;
-- Mantidos temporariamente porque as policies atuais de Storage ainda os utilizam.
grant execute on function public.exilados_current_perfil_app() to authenticated;
grant execute on function public.exilados_is_full_admin() to authenticated;
grant execute on function public.exilados_is_escalador() to authenticated;

-- Função pura usada por constraints/índices de nomes; necessária em INSERT/UPDATE.
do $$
declare
  r record;
begin
  for r in
    select
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as identity_arguments
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'exilados_norm_nome'
  loop
    execute format(
      'grant execute on function %I.%I(%s) to authenticated',
      r.schema_name,
      r.function_name,
      r.identity_arguments
    );
  end loop;
end
$$;

-- Reduz a superfície de objetos futuros. Novas tabelas ainda devem receber RLS/policies.
alter default privileges in schema public revoke all on tables from public, anon;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema public revoke all on sequences from public, anon;

commit;
