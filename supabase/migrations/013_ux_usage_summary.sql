begin;

do $$
begin
  if to_regclass('public.saved_searches') is null
     or to_regclass('public.contact_shares') is null
     or to_regprocedure('public.v3_staff_guard(boolean, boolean)') is null then
    raise exception 'MIGRATION 013 ABORTED - nothing was changed. Run 006, 010 and 012 first.';
  end if;
end $$;

create or replace function public.ux_active_students(p_from timestamptz, p_to timestamptz)
returns bigint language sql stable security definer set search_path = '' as $$
  select count(distinct a)::bigint from (
    select seller_id as a from public.items         where created_at >= p_from and created_at < p_to and seller_id is not null
    union all select buyer_id  from public.conversations where created_at >= p_from and created_at < p_to
    union all select sender_id from public.messages      where created_at >= p_from and created_at < p_to
    union all select user_id   from public.wishlists     where created_at >= p_from and created_at < p_to
    union all select user_id   from public.saved_searches where created_at >= p_from and created_at < p_to
  ) x;
$$;

create or replace function public.admin_usage_summary(p_days integer default 30)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  d      integer     := greatest(1, least(coalesce(p_days, 30), 365));
  v_to   timestamptz := now();
  v_from timestamptz := now() - make_interval(days => d);
  v_prev timestamptz := now() - make_interval(days => 2 * d);
begin
  perform public.v3_staff_guard(true, false);   -- admins only; read-only, so nothing is audited or rate limited

  return jsonb_build_object(
    'days', d,
    'generated_at', v_to,
    'new_students',     jsonb_build_object('now', (select count(*) from auth.users u where u.created_at >= v_from),
                                           'before', (select count(*) from auth.users u where u.created_at >= v_prev and u.created_at < v_from)),
    'active_students',  jsonb_build_object('now', public.ux_active_students(v_from, v_to), 'before', public.ux_active_students(v_prev, v_from)),
    'listings_posted',  jsonb_build_object('now', (select count(*) from public.items i where i.created_at >= v_from),
                                           'before', (select count(*) from public.items i where i.created_at >= v_prev and i.created_at < v_from)),
    'chats_started',    jsonb_build_object('now', (select count(*) from public.conversations c where c.created_at >= v_from),
                                           'before', (select count(*) from public.conversations c where c.created_at >= v_prev and c.created_at < v_from)),
    'messages_sent',    jsonb_build_object('now', (select count(*) from public.messages m where m.created_at >= v_from),
                                           'before', (select count(*) from public.messages m where m.created_at >= v_prev and m.created_at < v_from)),
    'listings_saved',   jsonb_build_object('now', (select count(*) from public.wishlists w where w.created_at >= v_from),
                                           'before', (select count(*) from public.wishlists w where w.created_at >= v_prev and w.created_at < v_from)),
    'searches_saved',   jsonb_build_object('now', (select count(*) from public.saved_searches s where s.created_at >= v_from),
                                           'before', (select count(*) from public.saved_searches s where s.created_at >= v_prev and s.created_at < v_from)),
    'contact_requests', jsonb_build_object('now', (select count(*) from public.contact_shares cs where cs.requested_at >= v_from),
                                           'before', (select count(*) from public.contact_shares cs where cs.requested_at >= v_prev and cs.requested_at < v_from)),
    'health', jsonb_build_object(
      'chats_started',        (select count(*) from public.conversations c where c.created_at >= v_from),
      'chats_answered',       (select count(*) from public.conversations c where c.created_at >= v_from
                                  and exists (select 1 from public.messages m where m.conversation_id = c.id and m.sender_id = c.seller_id)),
      'contact_requests',     (select count(*) from public.contact_shares cs where cs.requested_at >= v_from),
      'contact_approved',     (select count(*) from public.contact_shares cs where cs.requested_at >= v_from and cs.status in ('approved', 'revoked')),
      'active_listings',      (select count(*) from public.items i where i.status = 'active' and i.moderation_status = 'approved'),
      'stale_listings',       (select count(*) from public.items i where i.status = 'active' and i.moderation_status = 'approved'
                                  and i.created_at < now() - interval '14 days'
                                  and not exists (select 1 from public.conversations c where c.item_id = i.id)),
      'sold_or_rented_total', (select count(*) from public.items i where i.status in ('sold', 'rented'))
    ),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'day', g.day::date,
               'listings', (select count(*) from public.items i where i.created_at >= g.day and i.created_at < g.day + interval '1 day'),
               'chats',    (select count(*) from public.conversations c where c.created_at >= g.day and c.created_at < g.day + interval '1 day'),
               'messages', (select count(*) from public.messages m where m.created_at >= g.day and m.created_at < g.day + interval '1 day')
             ) order by g.day), '[]'::jsonb)
        from generate_series(date_trunc('day', now()) - make_interval(days => least(d, 30) - 1), date_trunc('day', now()), interval '1 day') as g(day)
    )
  );
end $$;

revoke all on function public.ux_active_students(timestamptz, timestamptz) from public, anon, authenticated, service_role;
revoke all on function public.admin_usage_summary(integer) from public, anon;
grant execute on function public.admin_usage_summary(integer) to authenticated;

commit;
