# Phase 7 — testing and CI

App-only release plus new test tooling. No SQL to run on production.

## What was added
- `npm test` now runs three files: validation/behaviour tests, route-protection tests, and architecture tests (126 + 18 + 49 checks).
- `supabase/tests/local/test_v4.py`: database tests for migrations 010–011 and the staff rules (about 75 checks).
- `e2e/`: Playwright browser tests (auth, listings, wishlist, contact consent, reporting/moderation, accessibility scan, phone layout).
- `.github/workflows/ci.yml`: on every push/PR runs unit tests, type check, production build and the database tests; a manual
  switch runs the browser tests. `.github/dependabot.yml` proposes dependency updates. `.nvmrc` pins Node 22.
- One small code change: the "which pages need sign-in" rule moved to `lib/supabase/paths.ts` so it can be tested.
  Behaviour is identical. `tsconfig.json` now excludes `e2e/` so the app build never looks at it.

## 1. Run what already works (5 minutes)
```bash
npm ci
npm test            # must end with three "All tests passed"
npm run typecheck
npm run build
```
If `typecheck` or `build` fails, paste me the first error.

## 2. Turn on CI
Commit and push. In GitHub open **Actions**; the "App" job should go green. The "Database" job installs a local PostgreSQL through
Python; it has never been run, so if it fails, open the log, copy the first FAIL line and send it to me. Expect to fix a few
wording or ordering assumptions in `test_v4.py` on the first run.

## 3. Set Vercel's Node version
Vercel → Project → Settings → General → Node.js Version → **22.x**, so production matches CI.

## 4. Build a staging copy for the browser tests (about 45 minutes, once)
The browser tests post, report, hide and delete listings, so they must never touch your real data.
1. Supabase → **New project** (call it `campus-market-staging`).
2. SQL Editor, run in this order: `supabase/schema.v1.sql`, then `supabase/migrations/002`, `003`, `005`, `006`, `007`, `008`, `009`, `010`, `011`
   (skip 001 and 004; they are read-only audits). Then run both verification scripts: 0 FAIL.
3. Authentication → turn **Confirm email OFF** on this staging project (so test users can sign in) and leave allowed domains empty.
4. Authentication → Users → **Add user** four times, choosing **Auto confirm**. Use `.edu` or `.ac.in`-style addresses you control, for example
   `e2e-a@test.edu`, `e2e-b@test.edu`, `e2e-mod@test.edu`, `e2e-admin@test.edu`, each with a long random password.
5. SQL Editor on **staging only**:
   ```sql
   update public.profiles set role = 'moderator' where email = 'e2e-mod@test.edu';
   update public.profiles set role = 'admin'     where email = 'e2e-admin@test.edu';
   ```
6. Vercel → Settings → Environment Variables: for the **Preview** scope only, set `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the **staging** project's values. Leave Production alone. Now every preview deployment uses staging.
7. Push a branch; Vercel builds a preview. Copy its URL.

## 5. Run the browser tests
Locally:
```bash
cd e2e
cp .env.example .env        # fill in the preview URL and the four accounts; never commit .env
npm install                 # then commit the generated package-lock.json
npx playwright install chromium
npx playwright test         # add --headed to watch
npx playwright show-report
```
Or in GitHub: add the eight `E2E_*` values under Settings → Secrets and variables → Actions, then Actions → CI → **Run workflow** → tick
"run browser tests" and paste the preview URL. The runner refuses to start if the URL is the production site.
Tests skip (not fail) when an account is not configured.

## 6. Expect to adjust on the first run
These suites were written against the page source but never run in a browser. Typical first-run fixes: a button label or timing,
the page needing a moment after a click, or an accessibility finding in the report. Send me the failure and the trace/screenshot
name and I will fix the test or the app, whichever is wrong.

## 7. Lint (optional, one command)
ESLint is still not installed. To add it: `npm install -D eslint eslint-config-next`, add an `eslint.config.mjs`, and add `npm run lint`
to the CI "App" job. This changes `package-lock.json`, so it has to be done on your machine.

## Done when
- [ ] `npm test`, `npm run typecheck`, `npm run build` all pass locally
- [ ] CI "App" job is green on GitHub
- [ ] CI "Database" job is green (or its failures are sent to me)
- [ ] Staging exists, previews point at it, and Production's environment variables are unchanged
- [ ] Browser tests run once against a preview, and every failure is either fixed or explained
- [ ] Node 22 is set in Vercel
