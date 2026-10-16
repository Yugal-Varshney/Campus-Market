'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth/session';
import { getCategories, getCategoryNames } from '@/lib/categories';
import { friendlyDbError } from '@/lib/errors';
import { parseListingQuery } from '@/lib/listings/search-params';
import { createClient } from '@/lib/supabase/server';
import type { ActionState } from '@/types';
import { describeSearch, hasSearchCriteria, searchParamsObject, serializeSearch } from './query';

const SIGN_IN = 'You need to sign in to continue.';

/** Saves what the student is currently looking at. The query is re-parsed and rebuilt here, so only valid filters are stored. */
export async function saveSearch(rawQuery: string): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: SIGN_IN };
  const [categories, names] = await Promise.all([getCategories(), getCategoryNames()]);
  const parsed = parseListingQuery(searchParamsObject(String(rawQuery).slice(0, 600)), categories.map((c) => c.value));
  if (!hasSearchCriteria(parsed)) return { error: 'Type a search or pick a filter first, then save it.' };

  const supabase = await createClient();
  const { error } = await supabase.from('saved_searches').insert({ query: serializeSearch(parsed), label: describeSearch(parsed, names) });
  if (error?.code === '23505') return { success: 'You already saved this search.' };
  if (error) return { error: friendlyDbError(error.message, 'Could not save this search. Please try again.') };
  revalidatePath('/saved-searches');
  return { success: 'Search saved. New matches will show up under Alerts.' };
}

export async function setSavedSearchAlerts(id: number, notify: boolean): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: SIGN_IN };
  const supabase = await createClient();
  // Turning alerts on starts counting from now, so old listings do not suddenly appear as "new".
  const patch = notify ? { notify, last_checked_at: new Date().toISOString() } : { notify };
  const { data, error } = await supabase.from('saved_searches').update(patch).eq('id', id).select('id');
  if (error || !data?.length) return { error: 'Could not update this saved search.' };
  revalidatePath('/saved-searches');
  return { success: notify ? 'Alerts are on.' : 'Alerts are off.' };
}

/** "I have looked at the new matches": the badge restarts from now. */
export async function markSavedSearchSeen(id: number): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: SIGN_IN };
  const supabase = await createClient();
  const { error } = await supabase.from('saved_searches').update({ last_checked_at: new Date().toISOString() }).eq('id', id);
  if (error) return { error: 'Could not update this saved search.' };
  revalidatePath('/saved-searches');
  return {};
}

export async function deleteSavedSearch(id: number): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: SIGN_IN };
  const supabase = await createClient();
  const { data, error } = await supabase.from('saved_searches').delete().eq('id', id).select('id');
  if (error || !data?.length) return { error: 'Could not delete this saved search.' };
  revalidatePath('/saved-searches');
  return { success: 'Saved search deleted.' };
}
