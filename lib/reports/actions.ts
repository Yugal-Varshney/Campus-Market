'use server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/session';
import { friendlyDbError } from '@/lib/errors';
import { validateReport } from '@/lib/validation/report';
import type { ActionState } from '@/types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Report a listing or a user. Migration 007 does the real work: the reporter, status and (for listings) the reported
 * user are set by a database trigger, duplicates and self-reports are rejected, and reports are rate limited.
 */
export async function submitReport(input: { listingId?: number; userId?: string; reason: string; description: string }): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: 'You need to sign in to continue.' };

  const checked = validateReport(String(input.reason ?? ''), String(input.description ?? ''));
  if (!checked.value) return { error: checked.error };

  const listingId = typeof input.listingId === 'number' && Number.isInteger(input.listingId) && input.listingId > 0 ? input.listingId : null;
  const reportedUserId = typeof input.userId === 'string' && UUID_RE.test(input.userId) ? input.userId : null;
  if (!listingId && !reportedUserId) return { error: 'There is nothing to report here.' };

  const supabase = await createClient();
  const { error } = await supabase.from('reports').insert({
    ...(listingId ? { listing_id: listingId } : { reported_user_id: reportedUserId }),
    reason: checked.value.reason,
    description: checked.value.description,
  });

  if (error) {
    if (error.code === '23505') return { error: 'You have already reported this. A moderator will review it.' };
    if (/cannot report yourself/i.test(error.message)) return { error: 'You cannot report yourself or your own listing.' };
    if (/listing not found/i.test(error.message)) return { error: 'This listing is no longer available.' };
    return { error: friendlyDbError(error.message, 'Could not send your report. Please try again.') };
  }
  return { success: 'Thanks. A moderator will review your report.' };
}
