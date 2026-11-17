-- Atomic premium email-code challenge lifecycle over the existing KV table.
--
-- WHY THIS EXISTS
-- The first implementation verified codes with read-modify-write inside the
-- Edge Function:
--
--   challenge = kv.get(key)          -- N parallel requests all read attempts = 0
--   result    = verify(challenge)
--   kv.set(key, {attempts: 1})       -- N parallel requests all write attempts = 1
--
-- That makes the 5-attempt cap worth 5 x N guesses under concurrency, and it
-- breaks single-use: two requests submitting the same correct code both see a
-- present challenge and both mint a 180-day premium session.
--
-- These SECURITY DEFINER functions are executable only by the Edge Function's
-- service role. Advisory transaction locks serialize even the no-row-yet
-- issuance case, where SELECT ... FOR UPDATE alone cannot lock a gap. This
-- mirrors 20260823000000_atomic_admin_challenges.sql, which already solved the
-- same problem for admin login.

create or replace function public.issue_premium_challenge_f8a832e3(
  p_key text,
  p_challenge jsonb,
  p_now_ms bigint,
  p_cooldown_ms bigint
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  existing_value jsonb;
begin
  -- Constrain the key namespace so a caller cannot aim this function at an
  -- arbitrary KV row such as an auth_session record.
  if p_key not like 'premium_challenge:%'
     or jsonb_typeof(p_challenge) <> 'object'
     or coalesce(p_challenge->>'codeHash', '') = ''
     or coalesce(p_challenge->>'email', '') = ''
     or coalesce((p_challenge->>'attempts')::integer, -1) <> 0 then
    raise exception 'invalid premium challenge payload';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_key, 0));
  select value into existing_value
    from public.kv_store_f8a832e3
    where key = p_key
    for update;

  -- Enforce the reissue cooldown in the database so parallel requests cannot
  -- each dispatch a fresh code to the same address.
  if found
     and p_now_ms - coalesce((existing_value->>'issuedAt')::bigint, 0) < p_cooldown_ms then
    return false;
  end if;

  insert into public.kv_store_f8a832e3(key, value)
  values (p_key, p_challenge)
  on conflict (key) do update set value = excluded.value;
  return true;
end;
$$;

create or replace function public.verify_premium_challenge_f8a832e3(
  p_key text,
  p_email text,
  p_code_hash text,
  p_now_ms bigint,
  p_ttl_ms bigint,
  p_max_attempts integer
) returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  challenge jsonb;
  attempts integer;
begin
  if p_key not like 'premium_challenge:%' then
    raise exception 'invalid premium challenge key';
  end if;

  -- The lock plus FOR UPDATE is what makes the attempt counter and the
  -- single-use delete atomic with respect to concurrent verification.
  perform pg_advisory_xact_lock(hashtextextended(p_key, 0));
  select value into challenge
    from public.kv_store_f8a832e3
    where key = p_key
    for update;

  if not found then
    return 'invalid';
  end if;

  if p_now_ms - coalesce((challenge->>'issuedAt')::bigint, 0) > p_ttl_ms then
    delete from public.kv_store_f8a832e3 where key = p_key;
    return 'expired';
  end if;

  attempts := greatest(coalesce((challenge->>'attempts')::integer, 0), 0);
  if attempts >= p_max_attempts then
    delete from public.kv_store_f8a832e3 where key = p_key;
    return 'locked';
  end if;

  -- The email must match the one the challenge was issued for, so a challenge
  -- record cannot be reused against a different account.
  if challenge->>'email' = p_email and challenge->>'codeHash' = p_code_hash then
    delete from public.kv_store_f8a832e3 where key = p_key;
    return 'success';
  end if;

  update public.kv_store_f8a832e3
    set value = jsonb_set(challenge, '{attempts}', to_jsonb(attempts + 1))
    where key = p_key;
  return 'invalid';
end;
$$;

create or replace function public.cancel_premium_challenge_f8a832e3(
  p_key text,
  p_code_hash text
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  existing_value jsonb;
begin
  if p_key not like 'premium_challenge:%' then
    raise exception 'invalid premium challenge key';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_key, 0));
  select value into existing_value
    from public.kv_store_f8a832e3
    where key = p_key
    for update;

  if not found then
    return false;
  end if;

  -- Only cancel the challenge this request issued. If a newer challenge has
  -- replaced it, the hash predicate leaves that newer one intact.
  if existing_value->>'codeHash' <> p_code_hash then
    return false;
  end if;

  delete from public.kv_store_f8a832e3 where key = p_key;
  return true;
end;
$$;

revoke all on function public.issue_premium_challenge_f8a832e3(text, jsonb, bigint, bigint) from public, anon, authenticated;
revoke all on function public.verify_premium_challenge_f8a832e3(text, text, text, bigint, bigint, integer) from public, anon, authenticated;
revoke all on function public.cancel_premium_challenge_f8a832e3(text, text) from public, anon, authenticated;

grant execute on function public.issue_premium_challenge_f8a832e3(text, jsonb, bigint, bigint) to service_role;
grant execute on function public.verify_premium_challenge_f8a832e3(text, text, text, bigint, bigint, integer) to service_role;
grant execute on function public.cancel_premium_challenge_f8a832e3(text, text) to service_role;
