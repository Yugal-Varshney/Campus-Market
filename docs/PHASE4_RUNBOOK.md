# Phase 4 — seller-consent contact, rental terms, report buttons

Two new SQL migrations and one app release. **The SQL was written carefully but could not be executed where it was
produced (no PostgreSQL here), so treat it as untested until you have run the verification script.** Each migration is a
single transaction: if anything fails, nothing is changed.

## What changes for students
- **Contact details need the seller's approval.** A buyer chats first, then taps "Ask for contact details" inside the
  chat. The seller sees Approve / Decline in the same chat (and a "Contact request" tag in the conversation list).
  Approved buyers can then view the seller's college email and phone. The seller can stop sharing later (details already
  seen cannot be taken back). A declined buyer can ask again after 24 hours. Limits: 5 requests per hour, 15 per day.
- **Rentals have a price unit and an optional longest rental**: "per day / week / month" and "up to N units".
  Existing rentals become "per week", which is what the site always showed.
- **Report buttons**: "Report this listing" on a listing page and "Report this user" inside a chat. Reports land in the
  `reports` table (migration 007); there is no moderator screen yet (Phase 5).
- Sellers can already edit title, description, category, condition, price, phone and photo from the listing page
  (Edit button). Editing works while the listing is available; mark a sold/rented listing available again first.

## Deploy order (important)
1. **Back up first**: Supabase → Database → Backups (or export the tables). If your plan has database branching, try steps 2–4 there.
2. SQL Editor → run `supabase/migrations/010_v4_contact_consent.sql`. It should end with `COMMIT` and no error.
3. Run `supabase/migrations/011_v4_rental_terms.sql`. If it stops with a constraint name
   (`items_title_len`, `items_description_len` or `items_condition_valid`), one old rental breaks an older rule: edit that
   listing's text, then run it again.
4. Run `supabase/verification/v4_post_migration_verification.sql` → the last row must be `0 FAIL`. Paste the result to me.
   Also re-run `v3_post_migration_verification.sql` (still 0 FAIL).
5. **Only then** deploy the app (Vercel). The app reads the new `items` columns, so deploying before step 3 breaks the listing pages.
6. Rollback of the app alone is safe, but an old app version cannot show contact details any more (the database now asks for approval).

## Test on the deployed site (two accounts, A = seller, B = buyer)
1. A posts a rental: unit "Week", longest rental "4". The card and listing page show "per week" and "Rent for up to 4 weeks".
2. A edits the listing (Edit): change the price and the unit to "Day"; both show on the card.
3. B opens the listing → "CHAT WITH SELLER" → in the chat taps "ASK FOR CONTACT DETAILS". B sees "Request sent".
4. A opens Messages → the conversation has a "Contact request" tag → Approve. (An open chat refreshes every ~15 seconds or on a new message.)
5. B sees "VIEW CONTACT DETAILS" → email (and phone, if A entered one) appear.
6. A taps "STOP SHARING". B can no longer view the details (their next attempt fails).
7. B uses "Report this listing" → success message; a second report of the same listing says you already reported it.
8. B tries to report their own listing / A reports themselves → clear refusal.

## Known gaps (planned)
- No moderator or admin screens yet (Phase 5); reports can be read in the SQL Editor (`select * from public.reports`).
- No push or email notification when a request arrives; the seller sees it when they open Messages.
- The new SQL has no automated tests in `supabase/tests/local` yet; `docs/SECURITY_TESTS.md` section F lists manual SQL tests.
