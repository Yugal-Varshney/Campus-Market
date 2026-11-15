import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { PAGE_SIZE } from '@/lib/constants';
import { friendlyDbError } from '@/lib/errors';
import { ITEM_COLUMNS, toListing } from './mappers';
import type { Listing, ListingQuery, Paginated, SellerContact, WishlistItem } from '@/types';

const cleanSearch = (q: string) => q.replace(/[%_\\,()*"']/g, ' ').replace(/\s+/g, ' ').trim();

export async function getListings(q: ListingQuery): Promise<Paginated<Listing>> {
  const supabase = await createClient();
  let query = supabase.from('items').select(ITEM_COLUMNS, { count: 'exact' });

  if (q.availableOnly) query = query.eq('status', 'active');
  if (q.categories.length) query = query.in('category', q.categories);
  if (q.minPrice !== null) query = query.gte('price', q.minPrice);
  if (q.maxPrice !== null) query = query.lte('price', q.maxPrice);
  const term = cleanSearch(q.q);
  if (term) {
    const like = `%${term}%`;
    query = query.or(`title.ilike.${like},description.ilike.${like},seller_name.ilike.${like}`);
  }

  if (q.sort === 'price-asc') query = query.order('price', { ascending: true }).order('id', { ascending: false });
  else if (q.sort === 'price-desc') query = query.order('price', { ascending: false }).order('id', { ascending: false });
  else query = query.order('created_at', { ascending: false }).order('id', { ascending: false });

  const from = (q.page - 1) * PAGE_SIZE;
  const { data, count, error } = await query.range(from, from + PAGE_SIZE - 1);
  if (error) throw new Error('Unable to load listings.');
  return { items: (data ?? []).map(toListing), total: count ?? 0, page: q.page, pageSize: PAGE_SIZE };
}

export async function getListing(id: number): Promise<Listing | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from('items').select(ITEM_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw new Error('Unable to load listing.');
  return data ? toListing(data) : null;
}

export async function getMyListings(userId: string): Promise<Listing[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('items').select(ITEM_COLUMNS).eq('seller_id', userId).order('created_at', { ascending: false });
  if (error) throw new Error('Unable to load your listings.');
  return (data ?? []).map(toListing);
}

export async function getWishlistIds(userId: string): Promise<number[]> {
  const supabase = await createClient();
  const { data } = await supabase.from('wishlists').select('item_id').eq('user_id', userId);
  return (data ?? []).map((r) => r.item_id);
}

export async function getWishlistCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from('wishlists')
    .select('item_id', { count: 'exact', head: true })
    .eq('user_id', userId);
  return error ? 0 : count ?? 0;
}

export async function getWishlist(userId: string): Promise<WishlistItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('wishlists')
    .select(`item_id, created_at, items (${ITEM_COLUMNS})`)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error('Unable to load your wishlist.');
  const out: WishlistItem[] = [];
  for (const row of data ?? []) {
    const item = row.items as unknown as Parameters<typeof toListing>[0] | null;
    if (item) out.push({ itemId: row.item_id, createdAt: row.created_at, listing: toListing(item) });
  }
  return out;
}

export async function getSellerContact(itemId: number): Promise<SellerContact | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_contact', { p_item_id: itemId });
  if (error) return { error: friendlyDbError(error.message, 'Contact details are unavailable right now.') };
  const row = data?.[0];
  if (!row) return { error: 'Contact details are unavailable for this listing.' };
  return { name: row.name, email: row.email, phone: row.phone };
}

export async function countConversations(itemId: number): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from('conversations')
    .select('id', { count: 'exact', head: true })
    .eq('item_id', itemId);
  return count ?? 0;
}

export async function countNewListings(q: ListingQuery, since: string, excludeSellerId?: string): Promise<number> {
  const supabase = await createClient();
  let query = supabase.from('items').select('id', { count: 'exact', head: true }).eq('status', 'active').gt('created_at', since);
  if (excludeSellerId) query = query.neq('seller_id', excludeSellerId);
  if (q.categories.length) query = query.in('category', q.categories);
  if (q.minPrice !== null) query = query.gte('price', q.minPrice);
  if (q.maxPrice !== null) query = query.lte('price', q.maxPrice);
  const term = cleanSearch(q.q);
  if (term) {
    const like = `%${term}%`;
    query = query.or(`title.ilike.${like},description.ilike.${like},seller_name.ilike.${like}`);
  }
  const { count, error } = await query;
  return error ? 0 : count ?? 0;
}

export async function getTrendingListings(limit = 4): Promise<Listing[]> {
  try {
    const supabase = await createClient();
    const { data: ranked, error } = await supabase.rpc('get_trending_items', { p_days: 14, p_limit: limit });
    if (error || !ranked?.length) return [];
    const ids = ranked.map((r) => r.item_id);
    const { data } = await supabase.from('items').select(ITEM_COLUMNS).in('id', ids).eq('status', 'active');
    const byId = new Map((data ?? []).map((row) => [row.id, toListing(row)]));
    return ids.map((id) => byId.get(id)).filter((l): l is Listing => Boolean(l));
  } catch {
    return [];
  }
}
