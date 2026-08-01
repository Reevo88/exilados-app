-- ExiladosApp - verificação conclusiva do Storage após 02_storage_hardening.sql.

do $$
declare
  invalid_count bigint;
begin
  select count(*) into invalid_count
  from storage.buckets
  where id in ('jogador-fotos', 'melhores-momentos')
    and public is true;

  if invalid_count > 0 then
    raise exception 'Falha: % buckets do aplicativo ainda são públicos', invalid_count;
  end if;

  if (select count(*) from storage.buckets where id in ('jogador-fotos', 'melhores-momentos')) <> 2 then
    raise exception 'Falha: um dos buckets esperados não foi encontrado';
  end if;

  select count(*) into invalid_count
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and ('anon' = any(roles) or 'public' = any(roles));

  if invalid_count > 0 then
    raise exception 'Falha: % policies de Storage ainda alcançam anon/PUBLIC', invalid_count;
  end if;

  with expected(policy_name, command_name) as (
    values
      ('exilados_storage_authenticated_select','SELECT'),
      ('exilados_storage_owner_insert','INSERT'),
      ('exilados_storage_owner_update','UPDATE'),
      ('exilados_storage_owner_delete','DELETE')
  )
  select count(*) into invalid_count
  from expected e
  where not exists (
    select 1
    from pg_policies p
    where p.schemaname = 'storage'
      and p.tablename = 'objects'
      and p.policyname = e.policy_name
      and p.cmd = e.command_name
      and p.roles = array['authenticated']::name[]
  );

  if invalid_count > 0 then
    raise exception 'Falha: % policies de Storage esperadas estão ausentes/divergentes', invalid_count;
  end if;

  select count(*) into invalid_count
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and policyname in (
      'exilados_storage_owner_insert',
      'exilados_storage_owner_update',
      'exilados_storage_owner_delete'
    )
    and (
      coalesce(qual, with_check, '') not ilike '%owner_id%auth.uid%'
      or coalesce(qual, with_check, '') not ilike '%foldername%'
      or coalesce(qual, with_check, '') not ilike '%is_app_admin%'
    );

  if invalid_count > 0 then
    raise exception 'Falha: % policies de escrita não exigem dono/pasta/ADM', invalid_count;
  end if;

  if has_table_privilege('anon', 'storage.objects', 'SELECT')
    or has_table_privilege('anon', 'storage.objects', 'INSERT')
    or has_table_privilege('anon', 'storage.objects', 'UPDATE')
    or has_table_privilege('anon', 'storage.objects', 'DELETE') then
    raise exception 'Falha: anon ainda possui privilégio direto em storage.objects';
  end if;
end
$$;

select
  'HARDENING STORAGE VALIDADO' as status,
  (select count(*) from storage.buckets
   where id in ('jogador-fotos', 'melhores-momentos') and not public) as private_buckets,
  (select count(*) from pg_policies
   where schemaname = 'storage' and tablename = 'objects') as active_storage_policies;
