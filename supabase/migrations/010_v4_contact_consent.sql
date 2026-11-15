begin;

do $$
begin
  if to_regclass('public.conversations') is null
     or to_regclass('public.items') is null
     or to_regclass('public.rate_limit_rules') is null
     or to_regprocedure('public.get_contact(bigint)') is null
     or to_regprocedure('public.rate_limit_check(text)') is null
     or to_regprocedure('public.assert_account_active()') is null
     or to_regprocedure('public.account_not_banned()') is null then
    raise exception 'MIGRATION 010 ABORTED - nothing was changed. Run 005 and 006 first.';
  end if;
end $$;

insert into public.rate_limit_rules (action, window_seconds, max_count) values
  ('contact_request', 3600, 5), ('contact_request', 86400, 15)
on conflict (action, window_seconds) do nothing;

create table if not exists public.contact_shares (
  conversation_id bigint primary key references public.conversations(id) on delete cascade,
  item_id         bigint not null references public.items(id) on delete cascade,
  buyer_id        uuid   not null references auth.users(id) on delete cascade,
  seller_id       uuid   not null references auth.users(id) on delete cascade,
  status          text   not null default 'requested',
  requested_at    timestamptz not null default now(),
  decided_at      timestamptz,
  constraint contact_shares_status_valid check (status in ('requested', 'approved', 'declined', 'revoked')),
  constraint contact_shares_decided_consistent check (
    (status = 'requested' and decided_at is null) or (status <> 'requested' and decided_at is not null))
);
create index if not exists contact_shares_seller_status on public.contact_shares (seller_id, status);
create index if not exists contact_shares_buyer_item    on public.contact_shares (buyer_id, item_id);

alter table public.contact_shares enable row level security;
revoke all on public.contact_shares from public, anon, authenticated, service_role;
grant select on public.contact_shares to authenticated;            -- writes only through the three RPCs below

drop policy if exists "contact_shares read mine" on public.contact_shares;
create policy "contact_shares read mine" on public.contact_shares for select to authenticated
  using (auth.uid() in (buyer_id, seller_id));
drop policy if exists "v4 banned no read" on public.contact_shares;
create policy "v4 banned no read" on public.contact_shares as restrictive for select to authenticated
  using ((select public.account_not_banned()));

create or replace function public.request_contact(p_conversation_id bigint)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  c  record;
  it record;
  s  record;
begin
  if v_uid is null then raise exception 'Sign in first.'; end if;
  perform public.assert_account_active();

  select cv.id, cv.item_id, cv.buyer_id, cv.seller_id into c
    from public.conversations cv where cv.id = p_conversation_id;
  if not found then raise exception 'CONTACT_SHARE: conversation not found.'; end if;
  if c.buyer_id <> v_uid then raise exception 'CONTACT_SHARE: conversation not found.'; end if;   -- same text on purpose: does not reveal which chats exist

  select i.status, i.moderation_status into it from public.items i where i.id = c.item_id;
  if not found then raise exception 'CONTACT_SHARE: this listing is no longer available.'; end if;
  if it.moderation_status <> 'approved' then raise exception 'CONTACT_SHARE: this listing is no longer available.'; end if;
  if it.status <> 'active' then raise exception 'CONTACT_SHARE: this item is no longer available.'; end if;

  select cs.status, cs.decided_at into s from public.contact_shares cs where cs.conversation_id = c.id for update;
  if found then
    if s.status in ('requested', 'approved') then return s.status; end if;          -- idempotent
    if s.status = 'declined' and s.decided_at > now() - interval '24 hours' then
      raise exception 'CONTACT_SHARE: the seller declined your request recently. You can ask again after 24 hours.';
    end if;
  end if;

  perform public.rate_limit_check('contact_request');

  insert into public.contact_shares (conversation_id, item_id, buyer_id, seller_id, status, requested_at, decided_at)
  values (c.id, c.item_id, c.buyer_id, c.seller_id, 'requested', now(), null)
  on conflict (conversation_id) do update
    set status = 'requested', requested_at = now(), decided_at = null;
  return 'requested';
end $$;

create or replace function public.respond_contact_request(p_conversation_id bigint, p_approve boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  s record;
  v_status text;
begin
  if v_uid is null then raise exception 'Sign in first.'; end if;
  perform public.assert_account_active();
  if p_approve is null then raise exception 'CONTACT_SHARE: choose approve or decline.'; end if;

  select cs.conversation_id, cs.status into s from public.contact_shares cs
   where cs.conversation_id = p_conversation_id and cs.seller_id = v_uid for update;
  if not found then raise exception 'CONTACT_SHARE: there is no request to answer.'; end if;
  if s.status <> 'requested' then raise exception 'CONTACT_SHARE: this request was already answered.'; end if;

  v_status := case when p_approve then 'approved' else 'declined' end;
  update public.contact_shares set status = v_status, decided_at = now() where conversation_id = s.conversation_id;
  return v_status;
end $$;

create or replace function public.revoke_contact_share(p_conversation_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  s record;
begin
  if v_uid is null then raise exception 'Sign in first.'; end if;
  select cs.conversation_id, cs.status into s from public.contact_shares cs
   where cs.conversation_id = p_conversation_id and cs.seller_id = v_uid for update;
  if not found then raise exception 'CONTACT_SHARE: nothing to stop sharing.'; end if;
  if s.status <> 'approved' then raise exception 'CONTACT_SHARE: you are not sharing contact details in this chat.'; end if;
  update public.contact_shares set status = 'revoked', decided_at = now() where conversation_id = s.conversation_id;
end $$;

revoke all on function public.request_contact(bigint), public.respond_contact_request(bigint, boolean), public.revoke_contact_share(bigint)
  from public, anon;
grant execute on function public.request_contact(bigint), public.respond_contact_request(bigint, boolean), public.revoke_contact_share(bigint)
  to authenticated;

create or replace function public.get_contact(p_item_id bigint)
returns table (name text, email text, phone text)
language plpgsql security definer set search_path = '' as $$
declare it record;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  perform public.assert_account_active();
  select i.status, i.moderation_status into it from public.items i where i.id = p_item_id;
  if not found then raise exception 'Listing not found.'; end if;
  if it.moderation_status <> 'approved' then raise exception 'Listing not found.'; end if;
  if it.status <> 'active' then raise exception 'This item is no longer available.'; end if;
  if not exists (select 1 from public.contact_shares s
                  where s.item_id = p_item_id and s.buyer_id = auth.uid() and s.status = 'approved') then
    raise exception 'CONTACT_SHARE: the seller has not shared contact details with you yet. Ask for them in the chat.';
  end if;
  perform public.rate_limit_check('contact_lookup');
  return query
    select i.seller_name, coalesce(p.contact_email, ''), coalesce(p.contact_phone, '')
      from public.items i left join public.item_private p on p.item_id = i.id where i.id = p_item_id;
end $$;

notify pgrst, 'reload schema';
commit;
