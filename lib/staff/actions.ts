'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/session';
import { getActingRole } from '@/lib/staff/auth';
import { cleanReason, isId, isUuid, ROLES, suspensionUntil } from '@/lib/validation/staff';

/**
 * Every action here is a thin wrapper around a database function from migrations 006-008. Those functions are the real
 * gatekeepers (role check, "moderators only act on students", 7-day cap, last-admin protection, audit trail); the checks
 * below only give faster, clearer messages. The database messages are written for staff, so they are shown as they are.
 */
type Result = { error?: string; success?: string };

async function gate(adminOnly = false): Promise<{ role: 'moderator' | 'admin' } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'You need to sign in to continue.' };
  const role = await getActingRole();
  if (role !== 'moderator' && role !== 'admin') return { error: 'You do not have permission to do that.' };
  if (adminOnly && role !== 'admin') return { error: 'Only an admin can do that.' };
  return { role };
}

function finish(error: { message: string } | null, ok: string): Result {
  if (error) return { error: error.message.slice(0, 300) };
  revalidatePath('/moderator', 'layout');
  revalidatePath('/admin', 'layout');
  revalidatePath('/marketplace', 'layout');
  return { success: ok };
}

const optId = (v: unknown): number | null => (isId(v) ? v : null);

export async function claimReport(reportId: number): Promise<Result> {
  const g = await gate(); if ('error' in g) return g;
  if (!isId(reportId)) return { error: 'Report not found.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('staff_claim_report', { p_report_id: reportId });
  return finish(error, 'Report claimed. It is now in review.');
}

export async function closeReport(reportId: number, outcome: 'resolve' | 'dismiss', reason: string): Promise<Result> {
  const g = await gate(); if ('error' in g) return g;
  if (!isId(reportId) || (outcome !== 'resolve' && outcome !== 'dismiss')) return { error: 'Report not found.' };
  const r = cleanReason(reason); if ('error' in r) return r;
  const supabase = await createClient();
  const { error } = outcome === 'resolve'
    ? await supabase.rpc('staff_resolve_report', { p_report_id: reportId, p_reason: r.value })
    : await supabase.rpc('staff_dismiss_report', { p_report_id: reportId, p_reason: r.value });
  return finish(error, outcome === 'resolve' ? 'Report resolved.' : 'Report dismissed.');
}

export async function hideListing(listingId: number, reason: string, reportId?: number): Promise<Result> {
  const g = await gate(); if ('error' in g) return g;
  if (!isId(listingId)) return { error: 'Listing not found.' };
  const r = cleanReason(reason); if ('error' in r) return r;
  const supabase = await createClient();
  const { error } = await supabase.rpc('staff_hide_listing', { p_listing_id: listingId, p_reason: r.value, p_report_id: optId(reportId) });
  return finish(error, 'Listing hidden. It no longer appears for students.');
}

export async function restoreListing(listingId: number, reason: string, reportId?: number): Promise<Result> {
  const g = await gate(); if ('error' in g) return g;
  if (!isId(listingId)) return { error: 'Listing not found.' };
  const r = cleanReason(reason); if ('error' in r) return r;
  const supabase = await createClient();
  const { error } = await supabase.rpc('staff_restore_listing', { p_listing_id: listingId, p_reason: r.value, p_report_id: optId(reportId) });
  return finish(error, 'Listing restored.');
}

export async function warnUser(userId: string, reason: string, reportId?: number): Promise<Result> {
  const g = await gate(); if ('error' in g) return g;
  if (!isUuid(userId)) return { error: 'User not found.' };
  const r = cleanReason(reason); if ('error' in r) return r;
  const supabase = await createClient();
  const { error } = await supabase.rpc('staff_warn_user', { p_user_id: userId, p_reason: r.value, p_report_id: optId(reportId) });
  return finish(error, 'Warning recorded. The person will see it on their next visit.');
}

export async function suspendUser(userId: string, duration: string, reason: string, reportId?: number): Promise<Result> {
  const g = await gate(); if ('error' in g) return g;
  if (!isUuid(userId)) return { error: 'User not found.' };
  const r = cleanReason(reason); if ('error' in r) return r;
  const u = suspensionUntil(duration, g.role); if ('error' in u) return u;
  const supabase = await createClient();
  const { error } = await supabase.rpc('staff_suspend_user', { p_user_id: userId, p_until: u.until, p_reason: r.value, p_report_id: optId(reportId) });
  return finish(error, 'User suspended.');
}

export async function unsuspendUser(userId: string, reason: string): Promise<Result> {
  const g = await gate(); if ('error' in g) return g;
  if (!isUuid(userId)) return { error: 'User not found.' };
  const r = cleanReason(reason); if ('error' in r) return r;
  const supabase = await createClient();
  const { error } = await supabase.rpc('staff_unsuspend_user', { p_user_id: userId, p_reason: r.value });
  return finish(error, 'Suspension lifted.');
}

export async function banUser(userId: string, reason: string, reportId?: number): Promise<Result> {
  const g = await gate(true); if ('error' in g) return g;
  if (!isUuid(userId)) return { error: 'User not found.' };
  const r = cleanReason(reason); if ('error' in r) return r;
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_ban_user', { p_user_id: userId, p_reason: r.value, p_report_id: optId(reportId) });
  return finish(error, 'User banned.');
}

export async function unbanUser(userId: string, reason: string): Promise<Result> {
  const g = await gate(true); if ('error' in g) return g;
  if (!isUuid(userId)) return { error: 'User not found.' };
  const r = cleanReason(reason); if ('error' in r) return r;
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_unban_user', { p_user_id: userId, p_reason: r.value });
  return finish(error, 'User unbanned.');
}

export async function setUserRole(userId: string, newRole: string, reason: string): Promise<Result> {
  const g = await gate(true); if ('error' in g) return g;
  if (!isUuid(userId)) return { error: 'User not found.' };
  if (!(ROLES as readonly string[]).includes(newRole)) return { error: 'Choose a valid role.' };
  const r = cleanReason(reason); if ('error' in r) return r;
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_set_role', { p_user_id: userId, p_new_role: newRole, p_reason: r.value });
  return finish(error, `Role changed to ${newRole}.`);
}
