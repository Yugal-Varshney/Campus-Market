/** What a student should be told about their own account state (migration 006). Pure so it can be unit-tested. */
export interface ProfileStatus {
  account_status: string;
  suspended_until: string | null;
  suspension_reason: string | null;
  last_warning_at: string | null;
  last_warning_reason: string | null;
}
export interface AccountNotice { kind: 'banned' | 'suspended' | 'warned'; text: string }

const WARNING_VISIBLE_MS = 14 * 86_400_000;
const utc = (ms: number) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';

export function buildAccountNotice(p: ProfileStatus | null, now: number = Date.now()): AccountNotice | null {
  if (!p) return null;
  if (p.account_status === 'banned') {
    return { kind: 'banned', text: 'Your account has been banned. You can sign in, but you cannot browse listings, post or message.' };
  }
  const until = p.suspended_until ? Date.parse(p.suspended_until) : null;
  if (p.account_status === 'suspended' && (until === null || until > now)) {
    const when = until === null ? ' until further notice' : ` until ${utc(until)}`;
    const why = p.suspension_reason ? ` Reason: ${p.suspension_reason}` : '';
    return { kind: 'suspended', text: `Your account is suspended${when}. You can browse, but you cannot post, message, save or report.${why}` };
  }
  if (p.last_warning_at && now - Date.parse(p.last_warning_at) < WARNING_VISIBLE_MS) {
    return { kind: 'warned', text: `A moderator sent you a warning${p.last_warning_reason ? `: ${p.last_warning_reason}` : '.'}` };
  }
  return null;
}
