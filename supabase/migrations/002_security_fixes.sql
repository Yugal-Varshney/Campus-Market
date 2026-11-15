--        #4 listing tampering      #5 server-side checks   #6 email-change bypass
--        #7 get_contact scraping   #11 owner delete (only when no chats)   + profiles write lock (role safety)

begin;

do $$
declare found text;
begin
  select string_agg(format('"%s" (%s, roles=%s)', policyname, cmd, roles::text), '; ' order by policyname)
    into found
  from pg_policies
  where schemaname = 'storage' and tablename = 'objects'
    and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    and policyname not in ('students upload photos',   -- V1 policy: dropped by this migration
                           'upload to own folder',     -- created by this migration
                           'delete own photos');       -- created by this migration
  if found is not null then
    raise exception 'MIGRATION 002 ABORTED - nothing was changed. Unexpected storage.objects write policy found: %', found
      using hint = 'Review it in Supabase -> Storage -> Policies. If it is not needed, drop it yourself '
                   '(drop policy "<name>" on storage.objects;) and run this file again.';
  end if;
end $$;

revoke insert, update, delete on public.profiles from anon, authenticated;

create table if not exists public.allowed_email_domains (
  domain text primary key check (domain = lower(domain)),
  note text,
  created_at timestamptz not null default now()
);
alter table public.allowed_email_domains enable row level security;  -- no policies: invisible to clients

create or replace function public.check_college_email() returns trigger
language plpgsql security definer set search_path = public as $$
declare dom text;
begin
  if tg_op = 'UPDATE' and new.email is not distinct from old.email then return new; end if;
  if new.email is null
     or new.email !~* '@[^@[:space:]]+\.(edu(\.[a-z]{2})?|ac\.[a-z]{2})$' then
    raise exception 'Use your college email (.edu or .ac.xx).';
  end if;
  dom := lower(split_part(new.email, '@', 2));
  if exists (select 1 from public.allowed_email_domains)
     and not exists (select 1 from public.allowed_email_domains d
                     where dom = d.domain or dom like '%.' || d.domain) then
    raise exception 'Your college is not on the approved list yet.';
  end if;
  return new;
end $$;

drop trigger if exists college_email_only on auth.users;
create trigger college_email_only before insert on auth.users
  for each row execute function public.check_college_email();
drop trigger if exists college_email_only_update on auth.users;
create trigger college_email_only_update before update of email on auth.users
  for each row execute function public.check_college_email();

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, email)
  values (new.id,
          coalesce(nullif(left(btrim(new.raw_user_meta_data->>'display_name'), 60), ''), 'Student'),
          new.email);
  return new;
end $$;

create or replace function public.items_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return new; end if;                 -- SQL editor / service role: untouched
  if tg_op = 'INSERT' then
    new.seller_id := uid;
    select display_name into new.seller_name from public.profiles where id = uid;
    new.seller_name := coalesce(new.seller_name, 'Student');
    new.created_at := now();
    new.status := 'active';
  else
    new.seller_id  := old.seller_id;                       -- cannot be reassigned
    new.seller_name := old.seller_name;                    -- cannot be spoofed
    new.created_at := old.created_at;                      -- cannot "bump" a listing
  end if;
  if new.image_url is not null and (tg_op = 'INSERT' or new.image_url is distinct from old.image_url) then
    if new.image_url !~ ('^https://[^/]+/storage/v1/object/public/item-images/' || uid::text || '/[A-Za-z0-9._-]+$') then
      raise exception 'Invalid image location.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists items_guard_trg on public.items;
create trigger items_guard_trg before insert or update on public.items
  for each row execute function public.items_guard();

drop policy if exists "sellers delete own" on public.items;
create policy "sellers delete own" on public.items for delete to authenticated
  using (seller_id = auth.uid());

create or replace function public.items_block_delete_with_chats() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.conversations where item_id = old.id) then
    raise exception 'This listing has conversations and cannot be deleted. Mark it as sold or rented instead.'
      using errcode = 'restrict_violation',
            hint = 'Existing conversations and messages are never deleted by deleting a listing.';
  end if;
  return old;
end $$;
drop trigger if exists items_block_delete_with_chats_trg on public.items;
create trigger items_block_delete_with_chats_trg before delete on public.items
  for each row execute function public.items_block_delete_with_chats();

create or replace function public.item_private_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  select email into new.contact_email from public.profiles where id = auth.uid();
  new.contact_email := coalesce(new.contact_email, '');
  return new;
end $$;
drop trigger if exists item_private_guard_trg on public.item_private;
create trigger item_private_guard_trg before insert or update on public.item_private
  for each row execute function public.item_private_guard();

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'items_title_len') then
    alter table public.items add constraint items_title_len
      check (char_length(btrim(title)) between 3 and 120) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'items_description_len') then
    alter table public.items add constraint items_description_len
      check (char_length(description) <= 1000) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'items_condition_valid') then
    alter table public.items add constraint items_condition_valid
      check (condition_label in ('new','like-new','good','fair')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'item_private_phone_format') then
    alter table public.item_private add constraint item_private_phone_format
      check (contact_phone = '' or contact_phone ~ '^[0-9+()[:space:]-]{7,20}$') not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'messages_body_len') then
    alter table public.messages add constraint messages_body_len
      check (char_length(body) <= 1000) not valid;
  end if;
end $$;

create or replace function public.conversations_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare it record;
begin
  if auth.uid() is null then return new; end if;
  select seller_id, status into it from public.items where id = new.item_id;
  if not found then raise exception 'Listing not found.'; end if;
  if it.seller_id is null then raise exception 'This is a showcase listing and cannot be messaged.'; end if;
  if it.status <> 'active' then raise exception 'This item is no longer available.'; end if;
  if it.seller_id = auth.uid() then raise exception 'You cannot start a chat on your own listing.'; end if;
  new.buyer_id  := auth.uid();
  new.seller_id := it.seller_id;
  select display_name into new.buyer_name from public.profiles where id = auth.uid();
  new.buyer_name := coalesce(new.buyer_name, 'Student');
  return new;
end $$;
drop trigger if exists conversations_guard_trg on public.conversations;
create trigger conversations_guard_trg before insert on public.conversations
  for each row execute function public.conversations_guard();

create table if not exists public.contact_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  item_id bigint not null,
  created_at timestamptz not null default now()
);
alter table public.contact_requests enable row level security;   -- no policies: only the function writes
create index if not exists contact_requests_user_time on public.contact_requests (user_id, created_at desc);

create or replace function public.get_contact(p_item_id bigint)
returns table (name text, email text, phone text)
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if not exists (select 1 from items where id = p_item_id) then raise exception 'Listing not found.'; end if;
  if not exists (select 1 from items where id = p_item_id and status = 'active') then
    raise exception 'This item is no longer available.';
  end if;
  if (select count(*) from contact_requests
      where user_id = auth.uid() and created_at > now() - interval '1 hour') >= 40 then
    raise exception 'Too many contact lookups. Try again later.';
  end if;
  insert into contact_requests (user_id, item_id) values (auth.uid(), p_item_id);
  return query select i.seller_name, coalesce(p.contact_email, ''), coalesce(p.contact_phone, '')
    from items i left join item_private p on p.item_id = i.id where i.id = p_item_id;
end $$;
revoke all on function public.get_contact(bigint) from public, anon;
grant execute on function public.get_contact(bigint) to authenticated;

update storage.buckets
   set file_size_limit = 5242880,
       allowed_mime_types = array['image/jpeg','image/png','image/webp']
 where id = 'item-images';

drop policy if exists "students upload photos" on storage.objects;
drop policy if exists "upload to own folder" on storage.objects;
create policy "upload to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'item-images' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "delete own photos" on storage.objects;
create policy "delete own photos" on storage.objects for delete to authenticated
  using (bucket_id = 'item-images' and (storage.foldername(name))[1] = auth.uid()::text);

commit;
