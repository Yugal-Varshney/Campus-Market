begin;

do $$
declare bad text;
begin
  if to_regprocedure('public.rate_limit_check(text)') is null or to_regprocedure('public.items_v3_insert_guard()') is null
     or to_regprocedure('public.account_is_active()') is null then
    raise exception 'MIGRATION 009 ABORTED - nothing was changed. Run 005 and 006 first.';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'upload to own folder')
     or not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'delete own photos') then
    raise exception 'MIGRATION 009 ABORTED - nothing was changed. The V2 storage policies "upload to own folder"/"delete own photos" are missing (run V2 002).';
  end if;
  select string_agg(format('"%s" (%s, roles=%s)', policyname, cmd, roles::text), '; ' order by policyname) into bad
    from pg_policies
   where schemaname = 'storage' and tablename = 'objects' and cmd in ('INSERT','UPDATE','DELETE','ALL')
     and policyname not in ('upload to own folder', 'delete own photos');
  if bad is not null then
    raise exception 'MIGRATION 009 ABORTED - nothing was changed. Unexpected storage.objects write policy: %', bad
      using hint = 'An extra permissive policy would defeat the suspension/upload limits. Drop it yourself, then run this file again.';
  end if;
end $$;

do $$
begin
  begin
    create policy "v3 privilege probe" on storage.objects for select to authenticated using (false);
    alter policy "v3 privilege probe" on storage.objects using (false);
    drop policy "v3 privilege probe" on storage.objects;
    raise exception 'v3_probe_ok';
  exception
    when insufficient_privilege then
      raise exception 'MIGRATION 009 ABORTED - nothing was changed. Role "%" cannot create/alter/drop policies on storage.objects.', current_user
        using hint = 'Nothing was modified. Do not change ownership of Supabase-managed tables; send me this message.';
    when others then
      if sqlerrm is distinct from 'v3_probe_ok' then raise; end if;
  end;
end $$;

create or replace function public.items_v3_limits() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null then perform public.rate_limit_check('listing_create'); end if;
  return new;
end $$;
drop trigger if exists items_v3_limits_trg on public.items;
create trigger items_v3_limits_trg before insert on public.items for each row execute function public.items_v3_limits();

create or replace function public.conversations_v3_limits() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null then perform public.rate_limit_check('chat_start'); end if;
  return new;
end $$;
drop trigger if exists conversations_v3_limits_trg on public.conversations;
create trigger conversations_v3_limits_trg before insert on public.conversations for each row execute function public.conversations_v3_limits();

create or replace function public.messages_v3_limits() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null then perform public.rate_limit_check('message_send'); end if;
  return new;
end $$;
drop trigger if exists messages_v3_limits_trg on public.messages;
create trigger messages_v3_limits_trg before insert on public.messages for each row execute function public.messages_v3_limits();

create or replace function public.v3_storage_upload_check() returns boolean
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform public.assert_account_active();
  perform public.rate_limit_check('photo_upload');
  return true;
end $$;
revoke all on function public.v3_storage_upload_check() from public, anon;
grant execute on function public.v3_storage_upload_check() to authenticated;

alter policy "upload to own folder" on storage.objects
  with check (bucket_id = 'item-images'
              and (storage.foldername(name))[1] = auth.uid()::text
              and (select public.account_is_active())
              and public.v3_storage_upload_check());
alter policy "delete own photos" on storage.objects
  using (bucket_id = 'item-images'
         and (storage.foldername(name))[1] = auth.uid()::text
         and (select public.account_is_active()));

create or replace function public.v3_normalize_name(p_name text) returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(translate(lower(coalesce(p_name, '')), '013457@$', 'oieastas'), '[^a-z0-9]', '', 'g')
$$;

create or replace function public.is_display_name_reserved(p_name text) returns boolean
language plpgsql immutable security definer set search_path = '' as $$
declare
  variants text[] := array[regexp_replace(lower(coalesce(p_name, '')), '[^a-z0-9]', '', 'g'), public.v3_normalize_name(p_name)];
  n text; v text; prev text; tok text;
  tokens text[] := array['administrator', 'campusmarket', 'moderator', 'support', 'system', 'admin'];
begin
  foreach n in array variants loop
    if n = '' then continue; end if;
    v := n;
    loop
      prev := v;
      foreach tok in array tokens loop v := replace(v, tok, ''); end loop;
      exit when v = prev;
    end loop;
    if v <> n and (v = '' or v ~ '^[0-9]+$') then return true; end if;
  end loop;
  return false;
end $$;
revoke all on function public.v3_normalize_name(text) from public, anon, authenticated, service_role;
revoke all on function public.is_display_name_reserved(text) from public;
grant execute on function public.is_display_name_reserved(text) to anon, authenticated;

create or replace function public.check_reserved_display_name() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if public.is_display_name_reserved(new.raw_user_meta_data ->> 'display_name') then
    raise exception 'RESERVED_NAME: that display name is reserved. Please choose another.' using errcode = '22023';
  end if;
  return new;
end $$;
revoke all on function public.check_reserved_display_name() from public, anon, authenticated, service_role;
drop trigger if exists reserved_display_name_only on auth.users;
create trigger reserved_display_name_only before insert on auth.users
  for each row execute function public.check_reserved_display_name();

create or replace function public.v3_purge_old_events(p_older_than interval default interval '2 days') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a bigint; b bigint := 0;
begin
  delete from public.rate_limit_events where created_at < now() - p_older_than;
  get diagnostics a = row_count;
  if to_regclass('public.contact_requests') is not null then
    delete from public.contact_requests where created_at < now() - p_older_than;
    get diagnostics b = row_count;
  end if;
  return jsonb_build_object('rate_limit_events_deleted', a, 'contact_requests_deleted', b);
end $$;
revoke all on function public.v3_purge_old_events(interval) from public, anon, authenticated, service_role;
revoke all on function public.items_v3_limits(), public.conversations_v3_limits(), public.messages_v3_limits() from public, anon, authenticated, service_role;

commit;
