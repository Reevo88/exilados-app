-- ExiladosApp - correção incremental do trigger genérico de ownership.
--
-- Problema corrigido:
-- enforce_row_owner() acessava OLD.auth_user_id em UPDATEs de qualquer tabela.
-- PostgreSQL não garante short-circuit em expressões booleanas; portanto um
-- UPDATE em confirmacoes falhava com 42703 antes de avaliar as permissões.

begin;

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

    -- Colunas exclusivas de jogadores só são acessadas dentro deste bloco.
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

    -- OLD/NEW são records polimórficos. PostgreSQL não garante short-circuit
    -- em AND; por isso colunas exclusivas ficam em uma ramificação própria.
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

-- Mantém a função indisponível para chamada direta pela API. Triggers já
-- vinculados continuam executando a versão substituída da função.
revoke all on function public.enforce_row_owner() from public, anon, authenticated;

commit;

-- Verificação estrutural: deve retornar a definição sem erro.
select
  p.oid::regprocedure as function_signature,
  p.prosecdef as security_definer,
  pg_get_functiondef(p.oid) like '%if tg_table_schema = ''public'' and tg_table_name = ''jogadores'' and not v_admin then%' as guarded_player_branch
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'enforce_row_owner';
