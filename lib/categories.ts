import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { CATEGORIES } from '@/lib/constants';
import type { CategoryOption } from '@/types';

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

export const getCategoryNames = cache(async (): Promise<Record<string, string>> => {
  const names: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]));
  try {
    const supabase = await createClient();
    const { data } = await supabase.from('categories').select('slug, name');
    for (const c of data ?? []) names[c.slug] = c.name;
  } catch {
  }
  return names;
});
