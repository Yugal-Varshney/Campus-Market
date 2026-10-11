// Run with: npm test   (plain assertions, no test framework needed)
import { validateListing, sniffImageType, validateImageMeta } from '../lib/validation/listing';
import { isCollegeEmail, safeNext, validateRegistration, parseOtpType } from '../lib/validation/auth';
import { parseListingQuery } from '../lib/listings/search-params';
import { resolveImageUrl } from '../lib/listings/mappers';
import { friendlyDbError, knownDbError } from '../lib/errors';
import { statusInfo, rentTerms } from '../lib/format';
import { validateReport } from '../lib/validation/report';
import { cleanReason, suspensionUntil, isUuid, isId } from '../lib/validation/staff';
import { buildAccountNotice } from '../lib/account/notice';

const ok = { title: 'Chem book', description: '', category: 'books', listingType: 'sell', price: 250, condition: 'good', phone: '+91 98765 43210' };
let failed = 0;
const t = (name: string, cond: boolean) => { if (!cond) failed++; console.log(cond ? 'PASS' : 'FAIL', name); };

t('valid listing accepted', !!validateListing(ok).value);
t('short title rejected', !!validateListing({ ...ok, title: 'ab' }).error);
t('price 0 rejected', !!validateListing({ ...ok, price: 0 }).error);
t('price > 100000 rejected', !!validateListing({ ...ok, price: 100001 }).error);
t('bad category rejected', !!validateListing({ ...ok, category: 'cars' }).error);
t('bad listing type rejected', !!validateListing({ ...ok, listingType: 'gift' }).error);
t('bad condition rejected', !!validateListing({ ...ok, condition: 'broken' }).error);
t('bad phone rejected', !!validateListing({ ...ok, phone: 'abc' }).error);
t('empty phone allowed', !!validateListing({ ...ok, phone: '' }).value);
t('long description rejected', !!validateListing({ ...ok, description: 'x'.repeat(1001) }).error);
t('png signature detected', sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0])) === 'image/png');
t('html disguised as image rejected', sniffImageType(new TextEncoder().encode('<script>alert(1)</script>')) === null);
t('svg mime rejected', !!validateImageMeta({ type: 'image/svg+xml', size: 10 }));
t('oversized image rejected', !!validateImageMeta({ type: 'image/png', size: 5 * 1024 * 1024 }));
t('.edu accepted', isCollegeEmail('a@mit.edu'));
t('.ac.in accepted', isCollegeEmail('a@iips.ac.in'));
t('.edu.in accepted', isCollegeEmail('a@x.edu.in'));
t('gmail rejected', !isCollegeEmail('a@gmail.com'));
t('mit.edu.evil.com rejected', !isCollegeEmail('a@mit.edu.evil.com'));
t('short password rejected', !!validateRegistration({ name: 'A', email: 'a@mit.edu', password: '123' }));
t('open redirect //evil blocked', safeNext('//evil.com') === '/marketplace');
t('absolute redirect blocked', safeNext('https://evil.com') === '/marketplace');
t('relative redirect allowed', safeNext('/sell') === '/sell');
t('tab-smuggled redirect blocked', safeNext('/\t/evil.com') === '/marketplace');
t('newline-smuggled redirect blocked', safeNext('/\n/evil.com') === '/marketplace');
t('space in redirect blocked', safeNext('/ /evil.com') === '/marketplace');
t('null byte in redirect blocked', safeNext('/\u0000x') === '/marketplace');
t('redirect keeps encoded query', safeNext('/sell?x=1&y=a%20b') === '/sell?x=1&y=a%20b');
t('redirect over 2000 chars blocked', safeNext('/' + 'a'.repeat(2001)) === '/marketplace');
const q = parseListingQuery({ category: 'books,hax,notes', maxPrice: 'abc', sort: 'drop table', page: '-3', q: '  chem  ' });
t('query params sanitised', q.categories.join() === 'books,notes' && q.maxPrice === null && q.sort === 'newest' && q.page === 1 && q.q === 'chem');
t('demo image filename resolves to /uploads', resolveImageUrl('calculator.jpg') === '/uploads/calculator.jpg' && resolveImageUrl('../uploads/calculator.jpg') === '/uploads/calculator.jpg');
t('absolute image URL untouched', resolveImageUrl('https://x.co/a.jpg') === 'https://x.co/a.jpg');

// ---- V3 database error mapping (migrations 005-009) ----
t('rate limit message is friendly', /5 per 60 minutes/.test(friendlyDbError('RATE_LIMIT: too many "listing_create" actions (limit 5 per 60 minutes). Please try again later.', 'x')));
t('rate limit hides internal action name', !/listing_create/.test(friendlyDbError('RATE_LIMIT: too many "listing_create" actions (limit 5 per 60 minutes). Please try again later.', 'x')));
t('rate limit without numbers still friendly', friendlyDbError('RATE_LIMIT: odd', 'x') !== 'x');
t('suspension message keeps the end date', /2026-10-12 10:00 UTC/.test(friendlyDbError('ACCOUNT_SUSPENDED: your account is suspended until 2026-10-12 10:00 UTC. You can browse but not post, message or report.', 'x')));
t('ban message mapped', friendlyDbError('ACCOUNT_BANNED: your account has been banned.', 'x') === 'Your account has been banned.');
t('hidden listing message mapped', /hidden by a moderator/.test(friendlyDbError('LISTING_HIDDEN: this listing was hidden by a moderator and cannot be changed.', 'x')));
t('open report delete message mapped', /open report/.test(friendlyDbError('LISTING_REPORTED: this listing has an open report and cannot be deleted. Mark it sold.', 'x')));
t('reserved name message mapped', /reserved/.test(friendlyDbError('RESERVED_NAME: that display name is reserved. Please choose another.', 'x')));
t('unknown database error falls back', friendlyDbError('duplicate key value violates unique constraint "items_pkey"', 'generic') === 'generic');
t('RLS error text is not shown to users', knownDbError('new row violates row-level security policy for table "items"') === null);
t('missing error falls back', friendlyDbError(undefined, 'generic') === 'generic');

// ---- email link types (token-hash flow) ----
t('signup link type accepted', parseOtpType('signup') === 'signup');
t('recovery link type accepted', parseOtpType('recovery') === 'recovery');
t('email_change link type accepted', parseOtpType('email_change') === 'email_change');
t('unknown link type rejected', parseOtpType('magiclink') === null);
t('missing link type rejected', parseOtpType(null) === null);
t('non-string link type rejected', parseOtpType(['recovery']) === null);

// ---- listing status labels ----
t('inactive listing shows UNAVAILABLE', statusInfo({ status: 'inactive', listingType: 'sell' }).label === 'UNAVAILABLE');
t('inactive listing counts as done', statusInfo({ status: 'inactive', listingType: 'rent' }).done === true);
t('active rent listing still FOR RENT', statusInfo({ status: 'active', listingType: 'rent' }).label === 'FOR RENT');

// ---- rental terms (migration 011) ----
const rent = { ...ok, listingType: 'rent', rentUnit: 'week', rentMaxUnits: '' };
t('rental with unit accepted', validateListing(rent).value?.rentUnit === 'week');
t('rental without unit rejected', !!validateListing({ ...rent, rentUnit: '' }).error);
t('rental with bad unit rejected', !!validateListing({ ...rent, rentUnit: 'year' }).error);
t('rental max empty means no limit', validateListing(rent).value?.rentMaxUnits === null);
t('rental max 4 weeks accepted', validateListing({ ...rent, rentMaxUnits: '4' }).value?.rentMaxUnits === 4);
t('rental max 0 rejected', !!validateListing({ ...rent, rentMaxUnits: '0' }).error);
t('rental max fractional rejected', !!validateListing({ ...rent, rentMaxUnits: '2.5' }).error);
t('rental max above unit limit rejected', !!validateListing({ ...rent, rentUnit: 'month', rentMaxUnits: '13' }).error);
t('rental max 12 months accepted', validateListing({ ...rent, rentUnit: 'month', rentMaxUnits: '12' }).value?.rentMaxUnits === 12);
t('sale listing drops rental fields', (() => { const v = validateListing({ ...ok, rentUnit: 'week', rentMaxUnits: '4' }).value; return v?.rentUnit === null && v?.rentMaxUnits === null; })());
t('sale listing needs no rental fields', !!validateListing(ok).value);
t('rentTerms per week with limit', (() => { const r = rentTerms({ listingType: 'rent', rentUnit: 'week', rentMaxUnits: 4 }); return r?.perUnit === 'per week' && r?.max === 'up to 4 weeks'; })());
t('rentTerms singular unit', rentTerms({ listingType: 'rent', rentUnit: 'month', rentMaxUnits: 1 })?.max === 'up to 1 month');
t('rentTerms per day without limit', (() => { const r = rentTerms({ listingType: 'rent', rentUnit: 'day', rentMaxUnits: null }); return r?.perUnit === 'per day' && r?.max === null; })());
t('legacy rental without unit falls back to week', rentTerms({ listingType: 'rent', rentUnit: null, rentMaxUnits: null })?.perUnit === 'per week');
t('sale listing has no rent terms', rentTerms({ listingType: 'sell', rentUnit: null, rentMaxUnits: null }) === null);

// ---- contact consent messages (migration 010) ----
t('contact share message mapped', friendlyDbError('CONTACT_SHARE: the seller has not shared contact details with you yet. Ask for them in the chat.', 'x').startsWith('The seller has not shared'));
t('contact decline cooldown message mapped', /24 hours/.test(friendlyDbError('CONTACT_SHARE: the seller declined your request recently. You can ask again after 24 hours.', 'x')));
t('plain contact errors still fall back', friendlyDbError('Listing not found.', 'generic') === 'generic');

// ---- reports (migration 007 rules) ----
t('report with reason accepted', validateReport('scam', '').value?.reason === 'scam');
t('report without reason rejected', !!validateReport('', '').error);
t('report with unknown reason rejected', !!validateReport('spam', '').error);
t('report "other" needs 10 characters', !!validateReport('other', 'too short').error);
t('report "other" with explanation accepted', !!validateReport('other', 'Seller asked me to pay in advance').value);
t('report details over 500 characters rejected', !!validateReport('scam', 'x'.repeat(501)).error);
t('report details are trimmed', validateReport('scam', '  fake photo  ').value?.description === 'fake photo');

// ---- staff screens: input rules ----
t('reason of 2 characters rejected', 'error' in cleanReason('ab'));
t('reason of 3 characters accepted', 'value' in cleanReason('abc'));
t('reason is trimmed', (() => { const r = cleanReason('  spam listing  '); return 'value' in r && r.value === 'spam listing'; })());
t('reason of 1001 characters rejected', 'error' in cleanReason('x'.repeat(1001)));
t('non-string reason rejected', 'error' in cleanReason(undefined));
const nowFixed = new Date('2026-10-12T10:00:00.000Z');
t('moderator 7-day suspension accepted', 'until' in suspensionUntil('7', 'moderator', nowFixed));
t('7-day suspension stays inside the 7-day cap', (() => { const r = suspensionUntil('7', 'moderator', nowFixed); return 'until' in r && r.until !== null && Date.parse(r.until) < nowFixed.getTime() + 7 * 86_400_000; })());
t('moderator 14-day suspension rejected', 'error' in suspensionUntil('14', 'moderator', nowFixed));
t('moderator indefinite suspension rejected', 'error' in suspensionUntil('indefinite', 'moderator', nowFixed));
t('admin indefinite suspension has no end date', (() => { const r = suspensionUntil('indefinite', 'admin', nowFixed); return 'until' in r && r.until === null; })());
t('admin 30-day suspension accepted', 'until' in suspensionUntil('30', 'admin', nowFixed));
t('suspension of 0 days rejected', 'error' in suspensionUntil('0', 'admin', nowFixed));
t('suspension of 1.5 days rejected', 'error' in suspensionUntil('1.5', 'admin', nowFixed));
t('suspension with junk choice rejected', 'error' in suspensionUntil('forever', 'admin', nowFixed));
t('uuid accepted', isUuid('3f2b8c1e-6a4d-4e7b-9c2a-1d5e8f7a6b3c'));
t('non-uuid rejected', !isUuid('not-a-uuid') && !isUuid(42) && !isUuid("1' or '1'='1"));
t('positive integer id accepted', isId(5));
t('zero, fractions and strings rejected as ids', !isId(0) && !isId(1.5) && !isId('5') && !isId(-3));

// ---- account notices shown to the person ----
const clean = { account_status: 'active', suspended_until: null, suspension_reason: null, last_warning_at: null, last_warning_reason: null };
const t0 = Date.parse('2026-10-12T10:00:00Z');
t('active account has no notice', buildAccountNotice(clean, t0) === null);
t('missing profile has no notice', buildAccountNotice(null, t0) === null);
t('banned account sees a ban notice', buildAccountNotice({ ...clean, account_status: 'banned' }, t0)?.kind === 'banned');
t('ban reason is not shown to the person', !/secret/.test(buildAccountNotice({ ...clean, account_status: 'banned', suspension_reason: 'secret staff note' }, t0)?.text ?? ''));
t('suspension notice shows end date', /2026-10-14 10:00 UTC/.test(buildAccountNotice({ ...clean, account_status: 'suspended', suspended_until: '2026-10-14T10:00:00Z' }, t0)?.text ?? ''));
t('suspension notice shows reason', /selling fake items/.test(buildAccountNotice({ ...clean, account_status: 'suspended', suspended_until: '2026-10-14T10:00:00Z', suspension_reason: 'selling fake items' }, t0)?.text ?? ''));
t('expired suspension shows nothing', buildAccountNotice({ ...clean, account_status: 'suspended', suspended_until: '2026-10-11T10:00:00Z' }, t0) === null);
t('open-ended suspension says until further notice', /further notice/.test(buildAccountNotice({ ...clean, account_status: 'suspended' }, t0)?.text ?? ''));
t('recent warning shown', buildAccountNotice({ ...clean, last_warning_at: '2026-10-10T10:00:00Z', last_warning_reason: 'be polite' }, t0)?.kind === 'warned');
t('old warning hidden after 14 days', buildAccountNotice({ ...clean, last_warning_at: '2026-09-20T10:00:00Z', last_warning_reason: 'be polite' }, t0) === null);

if (failed) { console.error(`\n${failed} test(s) failed`); process.exit(1); }
console.log('\nAll tests passed');
