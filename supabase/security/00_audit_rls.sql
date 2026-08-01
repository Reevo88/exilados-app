-- ExiladosApp - auditoria somente leitura de RLS, policies e grants.
-- Execute no Supabase SQL Editor ANTES da migration de hardening.

-- 1. Tabelas e estado real de RLS.
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced,
  case
    when not c.relrowsecurity then 'CRITICO: RLS DESATIVADO'
    when not c.relforcerowsecurity then 'ALTO: RLS NAO FORCADO'
    else 'OK'
  end as finding
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
order by c.relname;

-- 2. Policies completas e classificação conservadora de expressões permissivas.
with policies as (
  select
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check,
    lower(regexp_replace(coalesce(qual, ''), '\s+', '', 'g')) as qual_norm,
    lower(regexp_replace(coalesce(with_check, ''), '\s+', '', 'g')) as check_norm
  from pg_policies
  where schemaname = 'public'
)
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check,
  case
    when 'anon' = any(roles) or 'public' = any(roles)
      then 'CRITICO: POLICY ALCANCA ANON/PUBLIC'
    when cmd in ('ALL', 'SELECT', 'UPDATE', 'DELETE')
      and qual_norm in ('true', '(true)')
      then 'CRITICO: USING TRUE'
    when cmd in ('ALL', 'INSERT', 'UPDATE')
      and check_norm in ('true', '(true)')
      then 'CRITICO: WITH CHECK TRUE'
    when cmd = 'ALL' then 'ALTO: POLICY PARA ALL'
    else 'REVISAR'
  end as finding
from policies
order by tablename, policyname;

-- 3. Tabelas sem nenhuma policy, inclusive quando RLS estiver ligado.
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  'SEM POLICY' as finding
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policies p
  on p.schemaname = n.nspname
 and p.tablename = c.relname
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
group by n.nspname, c.relname, c.relrowsecurity
having count(p.policyname) = 0
order by c.relname;

-- 4. Grants diretos a anon/authenticated/PUBLIC.
select
  table_schema,
  table_name,
  grantee,
  string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema in ('public', 'storage')
  and grantee in ('anon', 'authenticated', 'PUBLIC')
group by table_schema, table_name, grantee
order by table_schema, table_name, grantee;

-- 5. Tabelas sem owner_id UUID NOT NULL.
select
  c.table_schema,
  c.table_name,
  case
    when col.column_name is null then 'CRITICO: owner_id AUSENTE'
    when col.data_type <> 'uuid' then 'CRITICO: owner_id NAO E UUID'
    when col.is_nullable = 'YES' then 'ALTO: owner_id ACEITA NULL'
    else 'OK'
  end as finding
from information_schema.tables c
left join information_schema.columns col
  on col.table_schema = c.table_schema
 and col.table_name = c.table_name
 and col.column_name = 'owner_id'
where c.table_schema = 'public'
  and c.table_type = 'BASE TABLE'
order by c.table_name;

-- 6. Funções SECURITY DEFINER e privilégios de execução: podem contornar RLS.
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by p.proname, arguments;

-- 7. Views/materialized views. Views comuns devem usar security_invoker.
select
  n.nspname as schema_name,
  c.relname as object_name,
  case c.relkind when 'v' then 'view' when 'm' then 'materialized view' end as object_type,
  c.reloptions
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('v', 'm')
order by c.relname;

-- 8. Storage: bucket público e policies atuais.
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
order by id;

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
order by policyname;
