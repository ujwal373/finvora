-- FINWORLD · Supabase schema (Milestone 1)
-- Run once in Supabase Dashboard > SQL Editor. Safe to re-run.
--
-- Security model
--   * Every table has Row Level Security on. Players can SELECT only their own rows.
--   * Clients get NO direct insert/update/delete on any table. All writes go through
--     SECURITY DEFINER functions that check auth.uid() and validate input.
--   * Profile, wallet (₹10,00,000 VIRTUAL money) and save slot are created by a trigger when the
--     auth user is created, exactly once. Logging in never re-initialises a wallet.
--   * Editing browser JavaScript or local storage cannot change the wallet: the client has no
--     write path to it. From Milestone 3, trades will be validated server-side in SQL functions.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- tables
create table if not exists public.players (
  id           uuid primary key references auth.users(id) on delete cascade,
  player_code  text unique not null default ('FW-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  full_name    text not null default '' check (char_length(full_name) <= 80),
  email        text not null,
  level        int  not null default 1 check (level >= 1),
  xp           int  not null default 0 check (xp >= 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.wallets (
  player_id          uuid primary key references public.players(id) on delete cascade,
  currency           text not null default 'INR_VIRTUAL' check (currency = 'INR_VIRTUAL'),
  initial_balance    numeric(16,2) not null default 1000000,
  available_balance  numeric(16,2) not null default 1000000 check (available_balance >= 0),
  realised_pl        numeric(16,2) not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists public.game_state (
  player_id   uuid primary key references public.players(id) on delete cascade,
  state       jsonb  not null default '{}'::jsonb,
  version     bigint not null default 1,
  updated_at  timestamptz not null default now()
);

-- Append-only ledger. Written only by server functions from Milestone 3 onward.
create table if not exists public.transactions (
  id           bigint generated always as identity primary key,
  player_id    uuid not null references public.players(id) on delete cascade,
  kind         text not null check (kind in ('buy','sell','deposit','withdrawal','sip','coupon','dividend','interest','maturity','reward','adjustment')),
  instrument   text,
  quantity     numeric(20,6),
  price        numeric(16,4),
  amount       numeric(16,2) not null,
  data_source  text not null default 'fictional_simulation' check (data_source in ('real','historical','fictional_simulation','user_assumption')),
  meta         jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists transactions_player_idx on public.transactions(player_id, created_at desc);

-- ---------------------------------------------------------------- RLS
alter table public.players      enable row level security;
alter table public.wallets      enable row level security;
alter table public.game_state   enable row level security;
alter table public.transactions enable row level security;

drop policy if exists players_select_own on public.players;
create policy players_select_own on public.players for select to authenticated using (id = (select auth.uid()));
drop policy if exists wallets_select_own on public.wallets;
create policy wallets_select_own on public.wallets for select to authenticated using (player_id = (select auth.uid()));
drop policy if exists game_state_select_own on public.game_state;
create policy game_state_select_own on public.game_state for select to authenticated using (player_id = (select auth.uid()));
drop policy if exists transactions_select_own on public.transactions;
create policy transactions_select_own on public.transactions for select to authenticated using (player_id = (select auth.uid()));

revoke all on public.players, public.wallets, public.game_state, public.transactions from anon;
revoke insert, update, delete, truncate on public.players, public.wallets, public.game_state, public.transactions from authenticated;
grant select on public.players, public.wallets, public.game_state, public.transactions to authenticated;

-- ---------------------------------------------------------------- new user bootstrap
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.players (id, email, full_name)
  values (new.id, new.email, left(coalesce(new.raw_user_meta_data->>'full_name', ''), 80))
  on conflict (id) do nothing;
  insert into public.wallets (player_id) values (new.id) on conflict (player_id) do nothing;
  insert into public.game_state (player_id) values (new.id) on conflict (player_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- For accounts created before this schema was installed. Inserts only what is missing.
create or replace function public.ensure_player()
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  insert into public.players (id, email, full_name)
  select u.id, u.email, left(coalesce(u.raw_user_meta_data->>'full_name', ''), 80) from auth.users u where u.id = uid
  on conflict (id) do nothing;
  insert into public.wallets (player_id) values (uid) on conflict (player_id) do nothing;
  insert into public.game_state (player_id) values (uid) on conflict (player_id) do nothing;
end $$;

-- ---------------------------------------------------------------- saving
-- Optimistic concurrency: the write succeeds only if the caller saw the latest version.
create or replace function public.save_game_state(p_state jsonb, p_base_version bigint)
returns bigint language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); v bigint;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if jsonb_typeof(p_state) <> 'object' then raise exception 'invalid_state'; end if;
  if pg_column_size(p_state) > 60000 then raise exception 'state_too_large'; end if;
  -- Money never lives in the save blob; strip anything that looks like it.
  p_state := p_state - 'wallet' - 'balance' - 'portfolio' - 'transactions';
  update public.game_state
     set state = p_state, version = version + 1, updated_at = now()
   where player_id = uid and version = p_base_version
  returning version into v;
  if v is null then raise exception 'version_conflict'; end if;
  return v;
end $$;

create or replace function public.update_display_name(p_name text)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); n text := btrim(p_name);
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if n is null or char_length(n) < 2 or char_length(n) > 80 then raise exception 'invalid_name'; end if;
  update public.players set full_name = n, updated_at = now() where id = uid;
end $$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.ensure_player(), public.save_game_state(jsonb, bigint), public.update_display_name(text) from public, anon;
grant execute on function public.ensure_player(), public.save_game_state(jsonb, bigint), public.update_display_name(text) to authenticated;
