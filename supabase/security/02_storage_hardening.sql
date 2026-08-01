-- ExiladosApp - hardening dos dois buckets encontrados na auditoria.
-- Esta versão aplica as alterações e termina com COMMIT.
-- Requer 01_strict_owner_rls.sql, que cria public.is_app_admin().
-- Requer que o frontend com createSignedUrl() já esteja publicado e testado.

begin;

update storage.buckets
set public = false
where id in ('jogador-fotos', 'melhores-momentos');

-- Policies permissivas são combinadas por OR. Para eliminar os acessos anônimos
-- e as regras antigas baseadas somente no bucket_id, todas são removidas.
do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
  loop
    execute format('drop policy %I on storage.objects', p.policyname);
  end loop;
end
$$;

-- Mídia esportiva é legível após login, mas nunca por anon.
-- Escrita continua limitada ao próprio objeto/pasta; ADM pode gerir terceiros.
create policy exilados_storage_authenticated_select
on storage.objects
for select
to authenticated
using (
  bucket_id in ('jogador-fotos', 'melhores-momentos')
);

create policy exilados_storage_owner_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id in ('jogador-fotos', 'melhores-momentos')
  and (
    (select public.is_app_admin())
    or (
      owner_id = (select auth.uid())::text
      and (storage.foldername(name))[1] = (select auth.uid())::text
    )
  )
);

create policy exilados_storage_owner_update
on storage.objects
for update
to authenticated
using (
  bucket_id in ('jogador-fotos', 'melhores-momentos')
  and (
    (select public.is_app_admin())
    or (
      owner_id = (select auth.uid())::text
      and (storage.foldername(name))[1] = (select auth.uid())::text
    )
  )
)
with check (
  bucket_id in ('jogador-fotos', 'melhores-momentos')
  and (
    (select public.is_app_admin())
    or (
      owner_id = (select auth.uid())::text
      and (storage.foldername(name))[1] = (select auth.uid())::text
    )
  )
);

create policy exilados_storage_owner_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id in ('jogador-fotos', 'melhores-momentos')
  and (
    (select public.is_app_admin())
    or (
      owner_id = (select auth.uid())::text
      and (storage.foldername(name))[1] = (select auth.uid())::text
    )
  )
);

revoke all on table storage.objects from anon;

-- Helpers antigos deixam de ser necessários após a troca das policies de Storage.
revoke execute on function public.exilados_current_perfil_app() from authenticated;
revoke execute on function public.exilados_is_full_admin() from authenticated;
revoke execute on function public.exilados_is_escalador() from authenticated;

commit;
