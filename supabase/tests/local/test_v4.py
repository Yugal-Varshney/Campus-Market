"""V4 migration tests (local Postgres stand-in): 010 seller-consent contact sharing, 011 rental terms, and the
staff permission rules the Phase 5 screens rely on.  Run:  python supabase/tests/local/test_v4.py

NOT EXECUTED where it was written (no PostgreSQL there): the first run is the real test of these checks.
If a check fails, read the printed message first; the test may need adjusting rather than the migration.
Same style as test_v3.py: everything talks to the database as the `authenticated` role (db.as_) or as owner (db.su)."""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import harness as h
from harness import U

R = []
def t(name, cond, info=''):
    R.append(bool(cond))
    print(('PASS ' if cond else 'FAIL ') + name + ((f'   [{str(info)[:170]}]' if (info and not cond) else '')))
ok = lambda r: r[0] == 'OK'
def err(r, *needles): return r[0] == 'ERR' and all(n.lower() in r[1].lower() for n in needles)
def head(s): print('\n=== ' + s)

PRE = ['005_v3_audit_events_and_rate_core.sql', '006_v3_accounts_and_moderation.sql', '007_v3_reporting.sql',
       '008_v3_categories.sql', '009_v3_rate_limits_hardening.sql']
M010, M011 = '010_v4_contact_consent.sql', '011_v4_rental_terms.sql'
A, B, C, D, E, F, G, H = (U[k] for k in 'ABCDEFGH')     # A-D students, E/F moderators, G/H admins (promoted below)
VERIFY = (h.HERE.parent.parent / 'verification' / 'v4_post_migration_verification.sql').read_text()

def build(name, upto=5, seed=True):
    d = h.build_v2_database(name, seed=seed)
    for f in PRE[:upto]:
        assert d.migrate(f)[0] == 'OK', f
    return d
def val(r): return r[1][0][0]
def call(db, uid, fn, *args, keep=True):
    """Call a function as `uid` and COMMIT the result (keep=True) so later steps see it."""
    ph = ','.join(['%s'] * len(args))
    return db.as_(uid, ('!' if keep else '') + f'select public.{fn}({ph})', args)
def verification_status(db):
    rows = db.su(VERIFY)
    return {r[1]: r[4] for r in rows}

# ───────────────────────────────────────────── 1. GATES + IDEMPOTENCY ─────────────────────────────────────────────
head('1. 010 / 011 gates abort safely; both migrations are idempotent')
d = build('v4g1', upto=1); s0 = h.snapshot(d)
r = d.migrate(M010); t('010 refuses to run without 006', err(r, 'MIGRATION 010 ABORTED', '005 and 006') and h.snapshot(d) == s0, r[1][:140])
r = d.migrate(M011); t('011 refuses to run without 006', err(r, 'MIGRATION 011 ABORTED', '006') and h.snapshot(d) == s0, r[1][:140])

db = build('v4main')
chem = db.su("select id from public.items where title='Chemistry book'")[0][0]
labcoat = db.su("select id from public.items where title='Lab coat'")[0][0]
calc = db.su("select id from public.items where title='Calculator'")[0][0]
conv = db.su('select id from public.conversations')[0][0]
fp0 = h.fingerprint(db)
r = db.migrate(M010); t('010 applies cleanly', ok(r), r[1][:200])
r = db.migrate(M011); t('011 applies cleanly', ok(r), r[1][:200])
s1 = h.snapshot(db)
t('010 again changes nothing (idempotent)', ok(db.migrate(M010)) and h.snapshot(db) == s1)
t('011 again changes nothing (idempotent)', ok(db.migrate(M011)) and h.snapshot(db) == s1)
t('existing V2 data byte-identical after 010 + 011 (8 table fingerprints)', h.fingerprint(db) == fp0, [k for k in fp0 if h.fingerprint(db)[k] != fp0[k]])
for uid, role in [(E, 'moderator'), (F, 'moderator'), (G, 'admin'), (H, 'admin')]:
    db.su('update public.profiles set role=%s where id=%s', (role, uid))

# ───────────────────────────────────────────── 2. RENTAL TERMS (011) ─────────────────────────────────────────────
head('2. Rental terms: backfill and the items_rent_terms_valid constraint')
t('existing rentals were set to per-week', sorted(x[0] for x in db.su("select rent_unit from public.items where listing_type='rent'")) == ['week', 'week'])
t('sale listings carry no rental fields', db.su("select count(*) from public.items where listing_type='sell' and (rent_unit is not null or rent_max_units is not null)")[0][0] == 0)
t('SQL: unknown unit rejected', err(db.as_(A, "update public.items set rent_unit='year' where id=%s", (labcoat,)), 'items_rent_terms_valid'))
t('SQL: rental fields on a sale listing rejected', err(db.as_(A, "update public.items set rent_unit='week' where id=%s", (chem,)), 'items_rent_terms_valid'))
t('SQL: longest rental of 0 rejected', err(db.as_(A, "update public.items set rent_max_units=0 where id=%s", (labcoat,)), 'items_rent_terms_valid'))
t('SQL: longest rental of 366 rejected', err(db.as_(A, "update public.items set rent_max_units=366 where id=%s", (labcoat,)), 'items_rent_terms_valid'))
t('owner can set unit + longest rental', ok(db.as_(A, "update public.items set rent_unit='month', rent_max_units=4 where id=%s", (labcoat,))))
INS = "insert into public.items(title,description,category,listing_type,price,condition_label{cols}) values ('Rental test','','books','{typ}',10,'good'{vals})"
t('API: new rental without a unit rejected', err(db.as_(A, INS.format(cols='', typ='rent', vals='')), 'items_rent_terms_valid'))
t('API: new rental with a unit accepted', ok(db.as_(A, INS.format(cols=',rent_unit', typ='rent', vals=",'day'"))))
t('API: new sale with a unit rejected', err(db.as_(A, INS.format(cols=',rent_unit', typ='sell', vals=",'day'")), 'items_rent_terms_valid'))
t('API: switching a rental to a sale without clearing the unit is rejected', err(db.as_(A, "update public.items set listing_type='sell' where id=%s", (labcoat,)), 'items_rent_terms_valid'))
t('API: switching to a sale works when the rental fields are cleared', ok(db.as_(A, "update public.items set listing_type='sell', rent_unit=null, rent_max_units=null where id=%s", (labcoat,))))

# ───────────────────────────────────────────── 3. CONTACT CONSENT (010) ─────────────────────────────────────────────
head('3. Contact consent: request -> approve -> read -> revoke')
t('no approval yet: buyer cannot read contact details', err(db.as_(B, 'select * from public.get_contact(%s)', (chem,)), 'contact_share', 'not shared'))
t('table starts empty', db.su('select count(*) from public.contact_shares')[0][0] == 0)
r = call(db, B, 'request_contact', conv); t('buyer requests contact details', ok(r) and val(r) == 'requested', r)
r = call(db, B, 'request_contact', conv); t('asking again while pending is idempotent', ok(r) and val(r) == 'requested')
t('exactly one share row exists', db.su('select count(*) from public.contact_shares')[0][0] == 1)
t('buyer cannot read contact details while the request is pending', err(db.as_(B, 'select * from public.get_contact(%s)', (chem,)), 'contact_share'))
t('buyer sees the share row', db.as_(B, 'select status from public.contact_shares')[1] == [('requested',)])
t('seller sees the share row', db.as_(A, 'select status from public.contact_shares')[1] == [('requested',)])
t('an outsider sees no share rows', db.as_(C, 'select count(*) from public.contact_shares')[1][0][0] == 0)
t('an outsider cannot request on someone else\'s chat (and learns nothing)', err(call(db, C, 'request_contact', conv), 'conversation not found'))
t('the seller cannot request on their own chat', err(call(db, A, 'request_contact', conv), 'conversation not found'))
t('the buyer cannot approve their own request', err(call(db, B, 'respond_contact_request', conv, True), 'no request to answer'))
t('an outsider cannot approve a request', err(call(db, C, 'respond_contact_request', conv, True), 'no request to answer'))
t('seller must choose approve or decline (null refused)', err(call(db, A, 'respond_contact_request', conv, None), 'choose'))
r = call(db, A, 'respond_contact_request', conv, True); t('seller approves', ok(r) and val(r) == 'approved', r)
t('answering twice is refused', err(call(db, A, 'respond_contact_request', conv, False), 'already answered'))
r = db.as_(B, 'select name, phone from public.get_contact(%s)', (chem,))
t('approved buyer reads the seller contact details', ok(r) and r[1][0][1] == '+91 98765 43210' and r[1][0][0] == 'Asha A', r)
t('approval is per buyer: another student still cannot', err(db.as_(C, 'select * from public.get_contact(%s)', (chem,)), 'contact_share'))
t('approval is per listing: the buyer cannot read other listings\' contacts', err(db.as_(B, 'select * from public.get_contact(%s)', (calc,)), 'contact_share'))
t('API roles cannot write the table directly', err(db.as_(B, "update public.contact_shares set status='approved'"), 'permission denied')
  and err(db.as_(B, "insert into public.contact_shares(conversation_id,item_id,buyer_id,seller_id) values (1,1,%s,%s)", (B, A)), 'permission denied')
  and err(db.as_(A, 'delete from public.contact_shares'), 'permission denied'))
t('anon cannot read the table or call the functions', err(db.as_(None, 'select * from public.contact_shares', role='anon'), 'permission denied')
  and err(db.as_(None, 'select public.request_contact(%s)', (conv,), role='anon'), 'permission denied'))
t('only the seller can stop sharing', err(call(db, B, 'revoke_contact_share', conv), 'nothing to stop'))
r = call(db, A, 'revoke_contact_share', conv); t('seller stops sharing', ok(r), r)
t('after revoking, the buyer can no longer read the details', err(db.as_(B, 'select * from public.get_contact(%s)', (chem,)), 'contact_share'))
t('stopping twice is refused', err(call(db, A, 'revoke_contact_share', conv), 'not sharing'))
r = call(db, B, 'request_contact', conv); t('after a revoke the buyer may ask again', ok(r) and val(r) == 'requested', r)
r = call(db, A, 'respond_contact_request', conv, False); t('seller declines', ok(r) and val(r) == 'declined', r)
t('a declined buyer must wait (24-hour cooldown)', err(call(db, B, 'request_contact', conv), 'declined', '24 hours'))
db.su("update public.contact_shares set decided_at = now() - interval '25 hours' where conversation_id=%s", (conv,))
r = call(db, B, 'request_contact', conv); t('after the cooldown the buyer may ask again', ok(r) and val(r) == 'requested', r)
call(db, A, 'respond_contact_request', conv, True)

head('3b. Consent respects moderation, status and account state')
t('contact_request rate-limit rules exist (1 hour + 1 day)', db.su("select count(*) from public.rate_limit_rules where action='contact_request'")[0][0] == 2)
r = call(db, G, 'admin_ban_user', B, 'testing ban', None)
t('a banned buyer cannot request or read', ok(r) and err(db.as_(B, 'select public.request_contact(%s)', (conv,)), 'banned')
  and db.as_(B, 'select count(*) from public.contact_shares')[1][0][0] == 0)
call(db, G, 'admin_unban_user', B, 'testing unban')
r = db.as_(E, "!select public.staff_suspend_user(%s, now()+interval '1 day','testing suspend',null)", (A,))
t('a suspended seller can still stop sharing (safety)', ok(r) and ok(call(db, A, 'revoke_contact_share', conv)))
t('a suspended seller cannot approve new requests', err(call(db, A, 'respond_contact_request', conv, True), 'suspended'))
call(db, E, 'staff_unsuspend_user', A, 'testing unsuspend')
call(db, B, 'request_contact', conv); call(db, A, 'respond_contact_request', conv, True)
call(db, E, 'staff_hide_listing', chem, 'testing hide', None)
t('hidden listing: contact details are no longer available even with an approval', err(db.as_(B, 'select * from public.get_contact(%s)', (chem,)), 'not found'))
call(db, A, 'revoke_contact_share', conv)
t('hidden listing: a new request is refused', err(call(db, B, 'request_contact', conv), 'no longer available'))
call(db, E, 'staff_restore_listing', chem, 'testing restore', None)
db.su("update public.items set status='sold' where id=%s", (chem,))
t('sold listing: a new request is refused', err(call(db, B, 'request_contact', conv), 'no longer available'))
db.su("update public.items set status='active' where id=%s", (chem,))
demo = db.su('select id from public.items where seller_id is null limit 1')
if demo: t('showcase listing (no seller): contact details cannot be read', err(db.as_(B, 'select * from public.get_contact(%s)', (demo[0][0],)), 'contact_share'))

# ───────────────────────────────────────────── 4. STAFF PERMISSIONS (Phase 5 screens) ─────────────────────────────────────────────
head('4. Staff permissions: the database refuses what the screens would hide')
t('student cannot call staff functions', err(call(db, A, 'staff_get_user', G, keep=False), 'insufficient'))
t('moderator cannot call admin functions', err(call(db, E, 'admin_ban_user', C, 'permission test', None, keep=False), 'insufficient'))
t('moderator cannot search users', err(db.as_(E, "select * from public.admin_search_users('a', 5, 0)"), 'insufficient'))
t('moderator cannot suspend for more than 7 days', err(db.as_(E, "select public.staff_suspend_user(%s, now()+interval '8 days','permission test',null)", (C,)), 'at most 7 days'))
t('moderator cannot act on staff accounts', err(call(db, E, 'staff_warn_user', G, 'permission test', None, keep=False), 'student'))
t('nobody can act on their own account', err(call(db, G, 'admin_set_role', G, 'student', 'permission test', keep=False), 'own account'))
t('moderator warns a student', ok(call(db, E, 'staff_warn_user', C, 'testing warning', None, keep=False)))
t('a reason is required', err(call(db, E, 'staff_warn_user', C, 'x', None, keep=False), 'reason'))
db.as_(C, "!insert into public.reports(listing_id,reason,description) values (%s,'scam','looks fake')", (calc,))
t('a student sees only their own reports', db.as_(C, 'select count(*) from public.reports')[1][0][0] == 1 and db.as_(D, 'select count(*) from public.reports')[1][0][0] == 0)
t('staff see every report', db.as_(E, 'select count(*) from public.reports')[1][0][0] >= 1)
t('a moderator can claim and resolve a report', ok(call(db, E, 'staff_claim_report', db.su('select id from public.reports limit 1')[0][0]))
  and ok(call(db, E, 'staff_resolve_report', db.su('select id from public.reports limit 1')[0][0], 'handled in test')))

head('4b. Category administration (migration 008 functions used by /admin/categories)')
t('moderator cannot create categories', err(call(db, E, 'admin_create_category', 'Lab Equipment', 'lab-equipment', '', keep=False), 'insufficient'))
r = call(db, G, 'admin_create_category', 'Lab Equipment', 'lab-equipment', 'Gloves, goggles'); t('admin creates a category', ok(r), r)
cat = db.su("select id from public.categories where slug='lab-equipment'")[0][0]
t('duplicate category refused', err(call(db, G, 'admin_create_category', 'Lab Equipment', 'lab-equipment2', '', keep=False), 'already exists'))
t('bad slug refused', err(call(db, G, 'admin_create_category', 'Weird', 'Bad Slug!', '', keep=False), 'slug'))
t('a listing can use the new category', ok(db.as_(A, "insert into public.items(title,description,category,listing_type,price,condition_label) values ('Goggles','','lab-equipment','sell',10,'good')")))
call(db, G, 'admin_set_category_active', cat, False, 'testing disable')
t('a disabled category cannot be used by new listings', db.as_(A, "insert into public.items(title,description,category,listing_type,price,condition_label) values ('Goggles','','lab-equipment','sell',10,'good')")[0] == 'ERR')
t('disabling needs a reason', err(call(db, G, 'admin_set_category_active', cat, True, 'x', keep=False), 'reason'))
call(db, G, 'admin_set_category_active', cat, True, 'testing enable')

# ───────────────────────────────────────────── 5. VERIFICATION SCRIPT ─────────────────────────────────────────────
head('5. The V4 verification script itself (syntax + results)')
st = verification_status(db)
t('verification script runs and reports 0 FAIL on a correct database', st.get('OVERALL (must be 0 FAIL)') == 'PASS' and 'FAIL' not in st.values(), [k for k, v in st.items() if v != 'PASS'])
t('verification script flags a database that has not had 010/011', verification_status(build('v4neg')).get('OVERALL (must be 0 FAIL)') == 'FAIL')

print(f'\n{sum(R)}/{len(R)} checks passed')
print('ALL GOOD' if all(R) else 'FAILURES at positions: ' + str([i + 1 for i, x in enumerate(R) if not x]))
sys.exit(0 if all(R) else 1)
