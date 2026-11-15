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