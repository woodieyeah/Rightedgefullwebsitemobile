-- Atomic admin email-code challenge lifecycle over the existing KV table.
-- These SECURITY DEFINER functions are intentionally executable only by the
-- Edge Function's service role. Advisory transaction locks serialize even the
-- no-row-yet issuance case, where SELECT ... FOR UPDATE alone cannot lock a gap.

create or replace function public.issue_admin_challenge_f8a832e3(
  p_key text,
  p_challenge jsonb,
  p_now_ms bigint
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  existing_value jsonb;
begin
  if p_key not like 'admin_auth_challenge:%'
     or jsonb_typeof(p_challenge) <> 'object'
     or coalesce((p_challenge->>'attemptsRemaining')::integer, 0) <> 5 then
    raise exception 'invalid admin challenge payload';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_key, 0));
  select value into existing_value
    from public.kv_store_f8a832e3
    where key = p_key
    for update;

  if found and coalesce((existing_value->>'expiresAt')::bigint, 0) > p_now_ms then
    return false;
  end if;

  insert into public.kv_store_f8a832e3(key, value)
  values (p_key, p_challenge)
  on conflict (key) do update set value = excluded.value;
  return true;
end;
$$;

create or replace function public.verify_admin_challenge_f8a832e3(
  p_key text,
  p_email text,
  p_code_hash text,
  p_now_ms bigint
) returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  challenge jsonb;
  attempts integer;
begin
  if p_key not like 'admin_auth_challenge:%' then
    raise exception 'invalid admin challenge key';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_key, 0));
  select value into challenge
    from public.kv_store_f8a832e3
    where key = p_key
    for update;

  if not found then
    return 'invalid';
  end if;

  attempts := greatest(coalesce((challenge->>'attemptsRemaining')::integer, 0), 0);
  if coalesce((challenge->>'expiresAt')::bigint, 0) <= p_now_ms then
    delete from public.kv_store_f8a832e3 where key = p_key;
    return 'invalid';
  end if;
  if attempts = 0 then
    return 'invalid';
  end if;

  if challenge->>'email' = p_email and challenge->>'codeHash' = p_code_hash then
    delete from public.kv_store_f8a832e3 where key = p_key;
    return 'success';
  end if;

  update public.kv_store_f8a832e3
    set value = jsonb_set(challenge, '{attemptsRemaining}', to_jsonb(attempts - 1))
    where key = p_key;
  return 'invalid';
end;
$$;

create or replace function public.cancel_admin_challenge_f8a832e3(
  p_key text,
  p_code_hash text
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  deleted_count integer;
begin
  if p_key not like 'admin_auth_challenge:%' then
    raise exception 'invalid admin challenge key';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_key, 0));
  delete from public.kv_store_f8a832e3
    where key = p_key and value->>'codeHash' = p_code_hash;
  get diagnostics deleted_count = row_count;
  return deleted_count = 1;
end;
$$;

revoke all on function public.issue_admin_challenge_f8a832e3(text, jsonb, bigint) from public, anon, authenticated;
revoke all on function public.verify_admin_challenge_f8a832e3(text, text, text, bigint) from public, anon, authenticated;
revoke all on function public.cancel_admin_challenge_f8a832e3(text, text) from public, anon, authenticated;

grant execute on function public.issue_admin_challenge_f8a832e3(text, jsonb, bigint) to service_role;
grant execute on function public.verify_admin_challenge_f8a832e3(text, text, text, bigint) to service_role;
grant execute on function public.cancel_admin_challenge_f8a832e3(text, text) to service_role;
