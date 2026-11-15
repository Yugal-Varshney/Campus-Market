# Setup notes

## Database

Run the files in `supabase/migrations/` in the Supabase SQL Editor, one file at a time, in number order (001 to 014).
`001` and `004` only read the database and print a report, so read their output before continuing.

Then add your college domain (lower case, no leading dot):

```sql
insert into public.allowed_email_domains (domain, note) values ('dauniv.ac.in', 'campus email domain')
on conflict (domain) do nothing;
```

The files in `supabase/verification/` are read-only checks you can run after the migrations.

## First admin

There is no admin signup in the app. Sign up normally, then run this in the SQL Editor:

```sql
update public.profiles set role = 'admin' where email = 'you@your-college.edu';
```

After that, roles are changed from the admin pages.

## Supabase Auth settings

- Authentication -> URL Configuration:
  - Site URL: `https://campus-market-v2.vercel.app`
  - Redirect URLs: `https://campus-market-v2.vercel.app/auth/callback` and `http://localhost:3000/auth/callback`
- Turn "Confirm email" on once custom SMTP is set up (the built-in sender is rate limited).
- Optional: use these links in the email templates so confirmation works on another device:

| Template | Link |
|---|---|
| Confirm signup | `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email` |
| Reset password | `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery` |
| Change email address | `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email_change` |

## Environment variables

Same four variables locally (`.env.local`) and on Vercel (Project Settings -> Environment Variables):

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_SITE_URL          # http://localhost:3000 locally, the Vercel URL in production
REQUIRE_LOGIN_TO_BROWSE       # true or false
```

Never put the service-role key in the app or in a `NEXT_PUBLIC_` variable. Redeploy after changing variables on Vercel.

## Demo account

`supabase/test-user/create_test_user.sql` creates `testuser@dauniv.ac.in`. Run it once in the SQL Editor.
See `testuserloginReadme.md` for the login details.

## Tests

```bash
npm test             # validation, routes, architecture checks
npm run typecheck
npm run lint
npm run test:db      # needs Python and a local Postgres (see supabase/tests/local/README.md)
```

Browser tests are in `e2e/` and run against a staging URL, not production. Copy `e2e/.env.example` and fill in test accounts.
