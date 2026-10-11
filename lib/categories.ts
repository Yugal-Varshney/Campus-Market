import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { CATEGORIES } from '@/lib/constants';
import type { CategoryOption } from '@/types';

/**
 * Categories students can pick or filter by: the active rows of public.categories (migration 008), in the admin's order.
 * If the table cannot be read, the four built-in categories are used so browsing and posting keep working.
 */
export const getCategories = cache(async (): Promise<CategoryOption[]> => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('categories')
      .select('slug, name')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    if (error || !data || data.length === 0) return CATEGORIES;
    return data.map((c) => ({ value: c.slug, label: c.name }));
  } catch {
    return CATEGORIES;
  }
});

/** slug -> display name for every category, including disabled ones, so old listings keep a proper label. */
export const getCategoryNames = cache(async (): Promise<Record<string, string>> => {
  const names: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]));
  try {
    const supabase = await createClient();
    const { data } = await supabase.from('categories').select('slug, name');
    for (const c of data ?? []) names[c.slug] = c.name;
  } catch {
    /* fall back to the built-in names */
  }
  return names;
});
