-- 012_ux_saved_searches_and_demand.sql — Campus Market UX Phase 4: saved searches, in-app alerts, and campus demand signals.
--
-- WHAT THIS CHANGES
--   * new table  public.saved_searches   one row per saved search (max 10 per student). Private: only the owner can read or change it.
--   * new RPC    get_trending_items(days, limit)           ids of active listings students are saving and messaging about right now
--   * new RPC    get_popular_searches(days, min_users, limit)   searches that at least 3 different students saved (never one person's search)
--   * new rate-limit rule 'saved_search_create' (10 per hour, 30 per day). Rules live in public.rate_limit_rules.
-- Nothing existing is dropped or rewritten, no row of an existing table is modified. Idempotent; one transaction.
-- Requires 005, 006 and 010.
--
-- BEHAVIOUR NOTES
--   * The two RPCs are SECURITY DEFINER because wishlists and conversations are private per person. They return only listing
--     ids with a combined score, or a search text with a head-count of at least 3 students. They never return who did what.
--   * Alerts are counted by the app (new active listings that match the saved search and are newer than last_checked_at),
--     so no copy of listing data is stored here and hidden or sold listings can never show up in an alert.
--   * Students may only change notify and last_checked_at on their own rows; query and label are fixed once saved.
--   * SECURITY DEFINER functions: search_path = '', EXECUTE for authenticated only.
-- Deploy order: run this file, THEN deploy the matching app version.

begin;

-- ───────────────────────── PRE-FLIGHT GATE ─────────────────────────
do $$
begin
  if to_regclass('public.items') is null
     or to_regclass('public.wishlists') is null
     or to_regclass('public.conversations') is null
     or to_regclass('public.rate_limit_rules') is null
     or to_regprocedure('public.rate_limit_check(text)') is null
     or to_regprocedure('public.assert_account_active()') is null
     or to_regprocedure('public.account_not_banned()') is null then
    raise exception 'MIGRATION 012 ABORTED - nothing was changed. Run 005, 006 and 010 first.';
  end if;
end $$;

-- ───────────────────────── rate limits (configuration data; existing rows are never overwritten) ─────────────────────────
insert into public.rate_limit_rules (action, window_seconds, max_count) values
  ('saved_search_create', 3600, 10), ('saved_search_create', 86400, 30)
on conflict (action, window_seconds) do nothing;

-- ───────────────────────── saved_searches ─────────────────────────
create table if not exists public.saved_searches (
  id              bigint generated always as identity primary key,
  user_id         uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  query           text        not null,   -- canonical query string built by the app, e.g. q=calculator&category=electronics&maxPrice=500
  label           text        not null,   -- human-readable summary shown in the list
  notify          boolean     not null default true,
  last_checked_at timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  constraint saved_searches_query_len check (char_length(query) between 1 and 300),
  constraint saved_searches_label_len check (char_length(label) between 1 and 120),
  constraint saved_searches_unique    unique (user_id, query)
);
create index if not exists saved_searches_user_time on public.saved_searches (user_id, created_at desc);

alter table public.saved_searches enable row level security;
revoke all on public.saved_searches from public, anon, authenticated, service_role;
grant select, insert, delete on public.saved_searches to authenticated;
grant update (notify, last_checked_at) on public.saved_searches to authenticated;

drop policy if exists "saved_searches select own" on public.saved_searches;
create policy "saved_searches select own" on public.saved_searches for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "saved_searches insert own" on public.saved_searches;
create policy "saved_searches insert own" on public.saved_searches for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists "saved_searches update own" on public.saved_searches;
create policy "saved_searches update own" on public.saved_searches for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "saved_searches delete own" on public.saved_searches;
create policy "saved_searches delete own" on public.saved_searches for delete to authenticated
  using (user_id = auth.uid());
drop policy if exists "ux banned no read saved_searches" on public.saved_searches;
create policy "ux banned no read saved_searches" on public.saved_searches as restrictive for select to authenticated
  using ((select public.account_not_banned()));
drop policy if exists "ux banned no write saved_searches" on public.saved_searches;
create policy "ux banned no write saved_searches" on public.saved_searches as restrictive for insert to authenticated
  with check ((select public.account_not_banned()));

-- Account must be in good standing, at most 10 saved searches, and the usual rate limit.
create or replace function public.saved_searches_insert_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_account_active();
  if (select count(*) from public.saved_searches s where s.user_id = new.user_id) >= 10 then
    raise exception 'SAVED_SEARCH: you can keep up to 10 saved searches. Delete one to add another.';
  end if;
  perform public.rate_limit_check('saved_search_create');
  return new;
end $$;

drop trigger if exists saved_searches_insert_guard on public.saved_searches;
create trigger saved_searches_insert_guard before insert on public.saved_searches
  for each row execute function public.saved_searches_insert_guard();

-- ───────────────────────── demand signals ─────────────────────────
-- Listings students are saving (1 point each) or opening a chat about (2 points each) in the last p_days.
-- A listing needs at least 2 points, so one person's interest never makes something "trending".
create or replace function public.get_trending_items(p_days integer default 14, p_limit integer default 8)
returns table (item_id bigint, score bigint)
language sql stable security definer set search_path = '' as $$
  with win as (select now() - make_interval(days => greatest(1, least(coalesce(p_days, 14), 90))) as since),
  w as (select x.item_id, count(*) as n from public.wishlists x, win where x.created_at > win.since group by x.item_id),
  c as (select x.item_id, count(*) as n from public.conversations x, win where x.created_at > win.since group by x.item_id)
  select i.id, (coalesce(w.n, 0) + 2 * coalesce(c.n, 0))::bigint as score
    from public.items i
    left join w on w.item_id = i.id
    left join c on c.item_id = i.id
   where auth.uid() is not null
     and i.status = 'active'
     and i.moderation_status = 'approved'
     and coalesce(w.n, 0) + 2 * coalesce(c.n, 0) >= 2
   order by score desc, i.created_at desc
   limit greatest(1, least(coalesce(p_limit, 8), 24));
$$;

-- Searches saved by at least 3 different students (never fewer, whatever the caller asks for).
create or replace function public.get_popular_searches(p_days integer default 30, p_min_users integer default 3, p_limit integer default 6)
returns table (search_query text, searchers bigint)
language sql stable security definer set search_path = '' as $$
  select s.query, count(distinct s.user_id)::bigint
    from public.saved_searches s
   where auth.uid() is not null
     and s.created_at > now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 180)))
   group by s.query
  having count(distinct s.user_id) >= greatest(coalesce(p_min_users, 3), 3)
   order by count(distinct s.user_id) desc, max(s.created_at) desc
   limit greatest(1, least(coalesce(p_limit, 6), 12));
$$;

revoke all on function public.get_trending_items(integer, integer), public.get_popular_searches(integer, integer, integer) from public, anon;
grant execute on function public.get_trending_items(integer, integer), public.get_popular_searches(integer, integer, integer) to authenticated;

commit;
