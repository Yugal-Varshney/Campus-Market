# Phase 5 — moderator and admin screens

**No new SQL.** Everything these screens call was installed by migrations 006–008 (all verified on your project). Phase 5 is
an app-only release: deploy the ZIP, then create staff accounts and run the checks below.

## What was added
| Screen | Who | What it does |
|---|---|---|
| `/moderator` | moderators + admins | Report queue with filters (Open, Unclaimed, In review, Resolved, Dismissed, All). |
| `/moderator/reports/<id>` | moderators + admins | The report text, the listing and person involved, earlier actions, and one action panel: claim, hide/restore the listing, warn, suspend (1/3/7 days; admins also 14/30 days or no end date), lift a suspension, resolve or dismiss. Admins also get Ban. |
| `/admin` | admins | Search students by name or email; the same actions plus Unban and Change role. |
| `/admin/audit` | admins | Append-only audit log of staff actions, and security events. |
| Account banner | everyone | Warned, suspended or banned people now see why and until when, at the top of every page. Ban reasons are never shown to the person; warning and suspension reasons are. |
| Menu links | staff | "Moderation" (and "Admin") in the account menu. |

## Safety design (what to know)
- **The database is the gate, not the page.** Every button calls a database function from migration 006/007 that checks the
  caller's role, rejects acting on yourself, limits moderators to student accounts and 7-day suspensions, protects the last
  admin, and writes the audit log. A student who calls the same function directly is refused.
- Staff pages return "not found" to everyone else, and signed-out visitors are sent to the login page.
- A suspended or banned moderator is treated as a student immediately (`acting_role()`), so the screens disappear for them.
- Moderators cannot search users (an admin-only function) and never see email addresses; they reach a person through a report.
- Reasons are required (3–1000 characters) and stored permanently.

## Deploy and first-time setup
1. Deploy the ZIP to Vercel. (No migration to run.)
2. Create the first admin, as described in section 3 of `docs/V3_MIGRATION_RUNBOOK.md` (SQL Editor, one `update public.profiles set role = 'admin' where email = '…'`).
   Sign out and back in, and the account menu shows **Moderation** and **Admin**.
3. Create a moderator from `/admin`: search the person, open their row, choose role **moderator**, give a reason, **Change role**.
4. Re-run `supabase/verification/v3_post_migration_verification.sql` and `v4_post_migration_verification.sql`: both must still show 0 FAIL.

## Test with four accounts (S = student, T = second student, M = moderator, A = admin)
1. As S: open `/moderator` and `/admin` → both show a "not found" page. Signed out → login page.
2. As T: report one of S's listings ("Report this listing").
3. As M: `/moderator` → the report is listed → open it → **Claim report** → status "in review".
4. As M: hide the listing with a reason → S's listing disappears for T; S still sees it (marked hidden by moderation) and cannot edit it.
5. As M: **Restore listing** → it is back for T.
6. As M: **Warn** S → S sees the warning banner. **Suspend** S for 1 day → S sees the suspension banner, cannot post or message, can still browse.
7. As M: try the suspension dropdown → only 1, 3 and 7 days are offered; Ban is not shown.
8. As M: **Resolve** the report with a reason → it moves to "Resolved".
9. As A: `/admin` → search S → **Lift suspension**; try **Ban**, then **Unban**. Try changing your own role → refused ("You cannot perform this action on your own account").
10. As A: `/admin/audit` → every action above appears with who, when and the reason.
11. Run section G of `docs/SECURITY_TESTS.md` in the SQL Editor (all blocks roll back).

## Known gaps
- Category management is **not** in this phase: the app still shows a fixed category list, so a category screen would change nothing
  students can see. It needs the form, filters and validation to read categories from the database first (planned with Phase 6).
- Banning or suspending does not sign the person out; the database simply stops them (they cannot read listings or messages when banned).
- No email or push notification to staff when a report arrives; check `/moderator` (Open filter) regularly.
- Staff screens are plain tables; Phase 6 covers visual polish and mobile review.
