import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getCategories } from '@/lib/categories';
import { countNewListings } from '@/lib/listings/queries';
import { parseListingQuery } from '@/lib/listings/search-params';
import { searchParamsObject } from './query';

export interface SavedSearch {
  id: number;
  label: string;
  query: string;
  notify: boolean;
  createdAt: string;
  lastCheckedAt: string;
  /** New matching listings since the student last looked. 0 when alerts are off. */
  newCount: number;
}

/** The signed-in student's saved searches, newest first, each with its number of new matches. */
export async function getSavedSearches(userId: string): Promise<SavedSearch[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('saved_searches')
    .select('id, label, query, notify, created_at, last_checked_at')
    .order('created_at', { ascending: false });
  if (error) throw new Error('Unable to load your saved searches.');
  const valid = (await getCategories()).map((c) => c.value);
  return Promise.all(
    (data ?? []).map(async (r) => ({
      id: r.id,
      label: r.label,
      query: r.query,
      notify: r.notify,
      createdAt: r.created_at,
      lastCheckedAt: r.last_checked_at,
      newCount: r.notify ? await countNewListings(parseListingQuery(searchParamsObject(r.query), valid), r.last_checked_at, userId) : 0,
    })),
  );
}

/** Total new matches across the searches that have alerts on, for the navbar badge. Looks at the five newest and never throws. */
export async function getAlertCount(userId: string): Promise<number> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('saved_searches')
      .select('query, last_checked_at')
      .eq('notify', true)
      .order('created_at', { ascending: false })
      .limit(5);
    if (!data?.length) return 0;
    const valid = (await getCategories()).map((c) => c.value);
    const counts = await Promise.all(data.map((r) => countNewListings(parseListingQuery(searchParamsObject(r.query), valid), r.last_checked_at, userId)));
    return counts.reduce((a, b) => a + b, 0);
  } catch {
    return 0;
  }
}

export async function isSearchSaved(query: string): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from('saved_searches').select('id').eq('query', query).maybeSingle();
    return Boolean(data);
  } catch {
    return false;
  }
}

/** Searches several students have saved (get_popular_searches, migration 012). Empty on any problem. */
export async function getPopularSearches(limit = 5): Promise<{ query: string; searchers: number }[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('get_popular_searches', { p_days: 30, p_min_users: 3, p_limit: limit });
    if (error) return [];
    return (data ?? []).map((r) => ({ query: r.search_query, searchers: r.searchers }));
  } catch {
    return [];
  }
}
