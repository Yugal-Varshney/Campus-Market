/** Shape of admin_usage_summary() (migration 013) and the small pure helpers the usage screen needs. */
export interface Pair { now: number; before: number }
export interface UsageSummary {
  days: number;
  generated_at: string;
  new_students: Pair; active_students: Pair; listings_posted: Pair; chats_started: Pair;
  messages_sent: Pair; listings_saved: Pair; searches_saved: Pair; contact_requests: Pair;
  health: {
    chats_started: number; chats_answered: number; contact_requests: number; contact_approved: number;
    active_listings: number; stale_listings: number; sold_or_rented_total: number;
  };
  daily: { day: string; listings: number; chats: number; messages: number }[];
}

/** "+25%", "−10%", "no change", or "new" when there was nothing in the earlier period to compare with. */
export function formatDelta(now: number, before: number): string {
  if (before === 0) return now === 0 ? 'no change' : 'new';
  const pct = Math.round(((now - before) / before) * 100);
  if (pct === 0) return 'no change';
  return `${pct > 0 ? '+' : '−'}${Math.abs(pct)}%`;
}

/** Whole-number percentage, or null when there is nothing to divide by (so the screen shows a dash instead of 0%). */
export function percent(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}
