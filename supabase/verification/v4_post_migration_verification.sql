-- V4 post-migration verification (migrations 010 + 011) — READ ONLY (one select statement). Run in the SQL Editor.
-- Expected: the last row says "0 FAIL". Paste the whole result back to me.
with c(area, check_name, expected, actual) as (
  select 'tables', 'contact_shares exists, RLS on, not forced', 'exists, RLS on',
    coalesce((select case when t.relrowsecurity and not t.relforcerowsecurity then 'exists, RLS on' else 'RLS wrong' end
                from pg_class t where t.oid = to_regclass('public.contact_shares')), 'missing')
  union all
  select 'policies', 'contact_shares has exactly 2 policies (own read + banned restrictive)', '2',
    (select count(*)::text from pg_policies where schemaname = 'public' and tablename = 'contact_shares')
  union all
  select 'privileges', 'contact_shares: authenticated SELECT only; anon / service_role none', 'SELECT only / none / none',
    case when to_regclass('public.contact_shares') is null then 'missing'
         else (case when has_table_privilege('authenticated', to_regclass('public.contact_shares'), 'SELECT')
                     and not has_table_privilege('authenticated', to_regclass('public.contact_shares'), 'INSERT, UPDATE, DELETE')
                    then 'SELECT only' else 'wrong' end)
              || ' / ' || (case when has_table_privilege('anon', to_regclass('public.contact_shares'), 'SELECT, INSERT, UPDATE, DELETE') then 'ANON HAS ACCESS' else 'none' end)
              || ' / ' || (case when has_table_privilege('service_role', to_regclass('public.contact_shares'), 'SELECT, INSERT, UPDATE, DELETE') then 'SERVICE HAS ACCESS' else 'none' end)
    end
  union all
  select 'functions', f.sig || ': definer, search_path pinned, authenticated only', 'ok',
    coalesce((select case when p.prosecdef
                           and array_to_string(coalesce(p.proconfig, '{}'::text[]), ',') like '%search_path%'
                           and has_function_privilege('authenticated', p.oid, 'EXECUTE')
                           and not has_function_privilege('anon', p.oid, 'EXECUTE')
                      then 'ok' else 'wrong' end
                from pg_proc p where p.oid = to_regprocedure('public.' || f.sig)), 'missing')
    from (values ('request_contact(bigint)'), ('respond_contact_request(bigint,boolean)'),
                 ('revoke_contact_share(bigint)'), ('get_contact(bigint)')) as f(sig)
  union all
  select 'functions', 'get_contact() now requires an approved share', 'true',
    coalesce((select (p.prosrc like '%contact_shares%')::text from pg_proc p where p.oid = to_regprocedure('public.get_contact(bigint)')), 'missing')
  union all
  select 'rate limits', 'contact_request rules (1 hour + 1 day)', '2',
    (select count(*)::text from public.rate_limit_rules where action = 'contact_request')
  union all
  select 'columns', 'items.' || col.n || ' exists and is nullable', 'yes',
    case when exists (select 1 from information_schema.columns
                       where table_schema = 'public' and table_name = 'items' and column_name = col.n and is_nullable = 'YES')
         then 'yes' else 'no' end
    from (values ('rent_unit'), ('rent_max_units')) as col(n)
  union all
  select 'constraints', 'items_rent_terms_valid exists and is validated', 'validated',
    coalesce((select case when k.convalidated then 'validated' else 'NOT VALID' end
                from pg_constraint k where k.conname = 'items_rent_terms_valid' and k.conrelid = to_regclass('public.items')), 'missing')
  union all
  select 'data', 'rentals without a rent_unit', '0',
    (select count(*)::text from public.items where listing_type = 'rent' and rent_unit is null)
  union all
  select 'data', 'sale listings carrying rental fields', '0',
    (select count(*)::text from public.items where listing_type <> 'rent' and (rent_unit is not null or rent_max_units is not null))
),
r as (
  select area, check_name, expected, actual, case when actual = expected then 'PASS' else 'FAIL' end as status from c
)
select area, check_name, expected, actual, status from r
union all
select 'summary', 'OVERALL (must be 0 FAIL)', 'FAIL = 0',
       (count(*) filter (where status = 'FAIL'))::text || ' FAIL / ' || (count(*) filter (where status = 'PASS'))::text || ' PASS',
       case when count(*) filter (where status = 'FAIL') = 0 then 'PASS' else 'FAIL' end
from r
order by 1, 2;
