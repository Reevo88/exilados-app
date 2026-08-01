-- ExiladosApp - restaura somente a função pura usada por constraints/índices.
-- Não concede nada a anon/PUBLIC.

do $$
declare
  r record;
  granted_count integer := 0;
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
    granted_count := granted_count + 1;
  end loop;

  if granted_count = 0 then
    raise exception 'Função public.exilados_norm_nome não encontrada';
  end if;
end
$$;

select
  p.oid::regprocedure as function_signature,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'exilados_norm_nome';
