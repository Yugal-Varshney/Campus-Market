-- 014_unread_messages.sql — Campus Market: know when someone has messaged you (unread tracking).
--
-- WHAT THIS CHANGES
--   * new table     public.conversation_reads   one row per (conversation, person): when that person last opened the chat.
--                   Private: a person can only read their own rows. Nobody writes it directly; the RPC below does.
--   * new RPC       mark_conversation_read(conversation_id)   "I have opened this chat" (participants only).
--   * new RPC       get_unread_count()                         how many messages from the OTHER person are newer than my
--                   last read, across all my chats. Capped at 100. SECURITY INVOKER, so messages RLS decides what is counted.
--   * backfill      every existing chat is marked read for both people as of now, so nobody opens the site to a wall of "unread".
-- Nothing existing is dropped or rewritten. Idempotent; one transaction. Requires 005 and 006 (account_not_banned).
--
-- BEHAVIOUR NOTES
--   * A chat with no read row yet counts messages newer than the chat's own created_at, so new chats need no trigger.
--   * Your own messages are never counted as unread for you.
--   * conversation_reads is deliberately NOT added to the Realtime publication. The app listens to public.messages (already
--     published) and re-asks get_unread_count(), so the number is always computed by the database.
--   * SECURITY DEFINER function: search_path = '', EXECUTE for authenticated only.
-- Deploy order: run this file, THEN deploy the matching app version.

begin;

-- ───────────────────────── PRE-FLIGHT GATE ─────────────────────────
do $$
begin
  if to_regclass('public.conversations') is null
     or to_regclass('public.messages') is null
     or to_regprocedure('public.account_not_banned()') is null then
    raise exception 'MIGRATION 014 ABORTED - nothing was changed. Run 005 and 006 first.';
  end if;
end $$;

-- ───────────────────────── conversation_reads ─────────────────────────
create table if not exists public.conversation_reads (
  conversation_id bigint not null references public.conversations(id) on delete cascade,
  user_id         uuid   not null default auth.uid() references auth.users(id) on delete cascade,
  last_read_at    timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

alter table public.conversation_reads enable row level security;

-- Read-only for people; all writes go through mark_conversation_read().
revoke all on table public.conversation_reads from anon, authenticated;
grant select on table public.conversation_reads to authenticated;

drop policy if exists "conversation_reads select own" on public.conversation_reads;
create policy "conversation_reads select own" on public.conversation_reads for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "ux banned no read conversation_reads" on public.conversation_reads;
create policy "ux banned no read conversation_reads" on public.conversation_reads as restrictive for select to authenticated
  using ((select public.account_not_banned()));

-- ───────────────────────── backfill (existing chats start as "read") ─────────────────────────
insert into public.conversation_reads (conversation_id, user_id, last_read_at)
select c.id, p.uid, now()
from public.conversations c
cross join lateral (values (c.buyer_id), (c.seller_id)) as p(uid)
on conflict (conversation_id, user_id) do nothing;

-- ───────────────────────── mark_conversation_read ─────────────────────────
create or replace function public.mark_conversation_read(p_conversation_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'NOT_SIGNED_IN: sign in to continue.';
  end if;
  if not exists (
    select 1 from public.conversations c
    where c.id = p_conversation_id and auth.uid() in (c.buyer_id, c.seller_id)
  ) then
    raise exception 'NOT_FOUND: conversation not found.';
  end if;

  insert into public.conversation_reads (conversation_id, user_id, last_read_at)
  values (p_conversation_id, auth.uid(), now())
  on conflict (conversation_id, user_id)
  do update set last_read_at = greatest(public.conversation_reads.last_read_at, excluded.last_read_at);
end $$;

revoke all on function public.mark_conversation_read(bigint) from public, anon;
grant execute on function public.mark_conversation_read(bigint) to authenticated;

-- ───────────────────────── get_unread_count ─────────────────────────
create or replace function public.get_unread_count()
returns integer language sql stable security invoker set search_path = '' as $$
  select count(*)::int from (
    select 1
    from public.messages m
    join public.conversations c on c.id = m.conversation_id
    left join public.conversation_reads r on r.conversation_id = c.id and r.user_id = auth.uid()
    where auth.uid() in (c.buyer_id, c.seller_id)
      and m.sender_id <> auth.uid()
      and m.created_at > coalesce(r.last_read_at, c.created_at)
    limit 100
  ) unread;
$$;

revoke all on function public.get_unread_count() from public, anon;
grant execute on function public.get_unread_count() to authenticated;

commit;
