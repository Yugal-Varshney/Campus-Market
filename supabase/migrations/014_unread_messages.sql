begin;

do $$
begin
  if to_regclass('public.conversations') is null
     or to_regclass('public.messages') is null
     or to_regprocedure('public.account_not_banned()') is null then
    raise exception 'MIGRATION 014 ABORTED - nothing was changed. Run 005 and 006 first.';
  end if;
end $$;

create table if not exists public.conversation_reads (
  conversation_id bigint not null references public.conversations(id) on delete cascade,
  user_id         uuid   not null default auth.uid() references auth.users(id) on delete cascade,
  last_read_at    timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

alter table public.conversation_reads enable row level security;

revoke all on table public.conversation_reads from anon, authenticated;
grant select on table public.conversation_reads to authenticated;

drop policy if exists "conversation_reads select own" on public.conversation_reads;
create policy "conversation_reads select own" on public.conversation_reads for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "ux banned no read conversation_reads" on public.conversation_reads;
create policy "ux banned no read conversation_reads" on public.conversation_reads as restrictive for select to authenticated
  using ((select public.account_not_banned()));

insert into public.conversation_reads (conversation_id, user_id, last_read_at)
select c.id, p.uid, now()
from public.conversations c
cross join lateral (values (c.buyer_id), (c.seller_id)) as p(uid)
on conflict (conversation_id, user_id) do nothing;

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
