-- Creates (or resets) the demo account for the teacher.
--   email:    testuser@dauniv.ac.in
--   password: testuser123
-- Run once in Supabase -> SQL Editor. Safe to run again: it never creates a duplicate.
-- The account is created already email-confirmed, so no inbox is needed.
-- Requires migrations 001-014 to be applied already (the profile row comes from the sign-up trigger).

create extension if not exists pgcrypto with schema extensions;

do $$
declare
  v_email    constant text := 'testuser@dauniv.ac.in';
  v_password constant text := 'testuser123';
  v_id       uuid;
begin
  select id into v_id from auth.users where lower(email) = v_email;

  if v_id is null then
    v_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new, email_change_token_current,
      phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
      extensions.crypt(v_password, extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{"display_name":"Test User"}', now(), now(),
      '', '', '', '', '', '', '', ''
    );

    insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_id, v_id::text, 'email',
            jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
            now(), now(), now());
  else
    -- Account already exists: just make sure the password and confirmation are right.
    update auth.users
       set encrypted_password = extensions.crypt(v_password, extensions.gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           updated_at = now()
     where id = v_id;
  end if;

  -- Safety net: the sign-up trigger normally creates this row already.
  insert into public.profiles (id, display_name, email)
  values (v_id, 'Test User', v_email)
  on conflict (id) do nothing;
end $$;

-- Check: should return one row with confirmed = true.
select u.email, u.email_confirmed_at is not null as confirmed, p.display_name, p.role
  from auth.users u left join public.profiles p on p.id = u.id
 where lower(u.email) = 'testuser@dauniv.ac.in';
