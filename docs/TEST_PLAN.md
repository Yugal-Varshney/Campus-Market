# Test plan and coverage map

Four layers, from cheapest to most realistic. Each row says **which layer covers it** and **what is still manual**.

| Layer | Where | Runs | Needs |
|---|---|---|---|
| **Unit + architecture** | `tests/*.test.ts` (`npm test`) | every push (CI job "App") | nothing |
| **Database** | `supabase/tests/local/test_v3.py`, `test_v4.py`, `test_verification.py` (`npm run test:db`) | every push (CI job "Database") | Python; no Supabase |
| **Browser (end to end)** | `e2e/tests/*.spec.ts` | on demand (CI job "Browser tests") or locally | a preview URL, a **staging** Supabase project, 4 test accounts |
| **Manual** | the checklists in `docs/PHASE*_RUNBOOK.md`, `docs/SECURITY_TESTS.md` | before each release | the real project |

## Coverage matrix

| Area | Unit / architecture | Database | Browser | Still manual |
|---|---|---|---|---|
| **Registration, college rule** | email-domain rules, password rules, reserved-name messages | allow-list trigger and reserved names (test_v3) | non-college address rejected | real confirmation email, Supabase Auth settings, rate limits |
| **Login / logout / sessions** | redirect hardening (`safeNext`), protected-path rules | n/a | wrong password, sign in/out, redirect tricks stay on site | session expiry, password reset email, cross-device link |
| **Authorization** | which URLs need sign-in; every server action checks the caller; no service-role key in app code | role escalation, IDOR, staff permissions, 7-day cap, last-admin, own-account guard (test_v3, test_v4) | students get 404 on staff pages; moderator is not admin | none beyond SECURITY_TESTS.md |
| **Listings** | field rules, price, condition, rental unit/longest rental, photo sniffing | rental constraint, backfill, ownership, rate limits | post, find, edit price, rental terms, sold/filter, delete | very large photos on a real phone |
| **Images** | magic-byte check, size, MIME | storage policies (own folder only) | upload of a generated PNG | Storage API limits, HEIC from iPhones |
| **Search / filters** | URL parsing, categories, availability flag | n/a | search by title, availability checkbox | relevance on a large catalogue |
| **Wishlist** | n/a | wishlist policies | save and remove | n/a |
| **Messaging** | n/a | chat policies, immutability | start chat | **Realtime delivery** between two devices |
| **Contact consent** | message mapping | request/approve/decline/revoke, cooldown, bans, hidden listings, privileges (test_v4) | full two-person flow, decline cooldown | n/a |
| **Reporting / moderation** | report and staff input rules, account notices | report rules, hide/restore, suspension, audit trail | student reports, moderator claims, hides, restores, resolves | audit log wording |
| **Categories** | slug/name rules, label lookup | create, disable, FK use (test_v4) | n/a (admin screen is manual) | admin screen click-through |
| **Accessibility** | contrast values were calculated (Phase 6) | n/a | automated WCAG A/AA scan of 12 pages (serious/critical fail) | screen reader, keyboard-only walkthrough |
| **Phone layout** | n/a | n/a | search box visible, no sideways scrolling on 5 pages | real devices (iOS Safari) |
| **Migrations** | read-only scripts contain no writes; begin/commit balanced | gates, idempotency, data preserved, verification script | n/a | running them on your real project |
| **Deployment** | build compiles in CI with placeholder env | n/a | smoke run against the preview | Vercel env vars, logs |

## What this does **not** prove
- Nothing here was executed against your live Supabase or Vercel. The unit, architecture, route and validation tests were run
  and pass; the database and browser suites were written but not executed where they were produced, so the first real run may
  need small corrections (selectors, a message wording). Read a failure before assuming the app is wrong.
- Automated accessibility scanners find roughly a third of real problems; they do not replace a keyboard and screen-reader pass.
- A green CI run means "the checks above passed", not "the site is secure".

## Keeping the plan honest
- Add a unit or database test with every bug fix; add a browser test for any new student-facing flow.
- `tests/static.test.ts` fails if a test file is not in `npm test`, a "read-only" SQL script gains a write, a server action skips the
  caller check, or an elevated key reaches application code.
