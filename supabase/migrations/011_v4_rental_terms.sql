-- 011_v4_rental_terms.sql — Campus Market V4: rentals get a price unit (day/week/month) and an optional maximum duration.
--
-- WHAT THIS CHANGES
--   * items.rent_unit        text     'day' | 'week' | 'month'   (required for rentals, NULL for items for sale)
--   * items.rent_max_units   integer  1..365, optional            (longest rental the seller will accept, in rent_unit)
--   * constraint items_rent_terms_valid enforces the two rules above for every row (NULL unit on a rental is explicitly refused:
--     a CHECK that evaluates to NULL would otherwise pass)
--   * existing rentals are set to 'week' (that is what the app always displayed before this migration)
-- No row is deleted. Existing sale listings are untouched. Idempotent; one transaction. Requires 006.
-- If the backfill UPDATE fails with a constraint name (items_title_len, items_description_len, items_condition_valid),
-- one old rental breaks an older V2 rule: open that listing, fix it, then run this file again. Nothing is changed on failure.
-- Deploy order: run 010, then this file, THEN deploy the matching app version (the app reads the new columns).

begin;

do $$
begin
  if to_regclass('public.items') is null
     or not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'items' and column_name = 'moderation_status') then
    raise exception 'MIGRATION 011 ABORTED - nothing was changed. Run 006 first.';
  end if;
end $$;

alter table public.items add column if not exists rent_unit text;
alter table public.items add column if not exists rent_max_units integer;

update public.items set rent_unit = 'week' where listing_type = 'rent' and rent_unit is null;

alter table public.items drop constraint if exists items_rent_terms_valid;
alter table public.items add constraint items_rent_terms_valid check (
  (listing_type = 'rent' and rent_unit is not null and rent_unit in ('day', 'week', 'month') and (rent_max_units is null or rent_max_units between 1 and 365))
  or (listing_type <> 'rent' and rent_unit is null and rent_max_units is null)
);

notify pgrst, 'reload schema';
commit;