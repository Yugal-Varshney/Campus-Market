select domain, note, created_at,
       case when domain <> lower(btrim(domain)) then 'FIX: use lower case, no spaces'
            when domain like '.%'               then 'FIX: remove the leading dot'
            when domain like '%@%'              then 'FIX: domain only, no @'
            else 'ok' end as format_check
from public.allowed_email_domains
order by domain;

select p.email, p.role, p.account_status,
       case when not exists (select 1 from public.allowed_email_domains) then 'allow-list is empty'
            when exists (select 1 from public.allowed_email_domains d
                         where lower(split_part(p.email, '@', 2)) = d.domain
                            or lower(split_part(p.email, '@', 2)) like '%.' || d.domain) then 'allowed'
            else 'NOT ON ALLOW-LIST' end as allow_status
from public.profiles p
order by p.email;

select count(*)                                              as accounts,
       count(*) filter (where email_confirmed_at is not null) as confirmed,
       count(*) filter (where email_confirmed_at is null)     as unconfirmed
from auth.users;

select role, count(*) as accounts from public.profiles group by role order by role;

select action, window_seconds, max_count from public.rate_limit_rules order by action, window_seconds;

select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'item-images';

select moderation_status, status, count(*) as listings
from public.items group by moderation_status, status order by moderation_status, status;
