-- Local verification of supabase/schema.sql against plain PostgreSQL 16.
-- Mocks the bits of Supabase the schema relies on (auth.users, auth.uid(), roles), then
-- checks: bootstrap trigger, RLS isolation, no client write path to wallets, versioned saves.
\set ON_ERROR_STOP on
create role anon nologin; create role authenticated nologin;
create schema auth;
grant usage on schema auth, public to anon, authenticated;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant execute on function auth.uid() to anon, authenticated;

\i supabase/schema.sql

-- Two players sign up
insert into auth.users values ('11111111-1111-1111-1111-111111111111', 'a@x.in', '{"full_name":"Asha"}');
insert into auth.users values ('22222222-2222-2222-2222-222222222222', 'b@x.in', '{"full_name":"Bala"}');

do $$ begin
  assert (select count(*) from public.players) = 2, 'players created by trigger';
  assert (select available_balance from public.wallets where player_id = '11111111-1111-1111-1111-111111111111') = 1000000, 'wallet starts at 10 lakh virtual';
  assert (select full_name from public.players where id = '11111111-1111-1111-1111-111111111111') = 'Asha', 'name from metadata';
end $$;

-- Act as Asha
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);

do $$ begin
  assert (select count(*) from public.players) = 1, 'RLS: sees only own player row';
  assert (select count(*) from public.wallets) = 1, 'RLS: sees only own wallet';
end $$;

-- Direct wallet tampering must fail
do $$ begin
  begin
    update public.wallets set available_balance = 99999999;
    raise exception 'wallet update should have been denied';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.transactions (player_id, kind, amount) values (auth.uid(), 'reward', 5000000);
    raise exception 'transaction insert should have been denied';
  exception when insufficient_privilege then null; end;
end $$;

-- ensure_player is idempotent: does not reset the wallet
select public.ensure_player();

-- Versioned saving
do $$ declare v bigint; begin
  v := public.save_game_state('{"player":{"x":1},"wallet":{"available":99999999}}', 1);
  assert v = 2, 'version increments';
  assert not ((select state from public.game_state) ? 'wallet'), 'wallet stripped from save blob';
  begin
    perform public.save_game_state('{"player":{"x":2}}', 1); -- stale base version
    raise exception 'stale save should conflict';
  exception when others then
    if sqlerrm <> 'version_conflict' then raise; end if;
  end;
  assert (select state->'player'->>'x' from public.game_state) = '1', 'stale save did not overwrite';
end $$;

-- Cannot save into someone else's slot, cannot see it either
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
do $$ begin
  assert (select version from public.game_state) = 1, 'Bala sees own untouched slot';
  assert (select count(*) from public.game_state where player_id = '11111111-1111-1111-1111-111111111111') = 0, 'RLS hides Asha';
end $$;

select public.update_display_name('Bala R');
reset role;
do $$ begin
  assert (select available_balance from public.wallets where player_id = '11111111-1111-1111-1111-111111111111') = 1000000, 'wallet unchanged after everything';
  assert (select full_name from public.players where id = '22222222-2222-2222-2222-222222222222') = 'Bala R', 'rename via RPC';
end $$;

-- Anonymous users get nothing
set role anon;
do $$ begin
  begin perform 1 from public.wallets; raise exception 'anon read should fail';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
\echo 'ALL SCHEMA CHECKS PASSED'
