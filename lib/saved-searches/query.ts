import { categoryLabel } from '@/lib/constants';
import { formatPrice } from '@/lib/format';
import type { ListingQuery } from '@/types';

/** What a saved search is allowed to remember: only things that change WHICH listings match (never sort, page or sold). */
export function hasSearchCriteria(q: ListingQuery): boolean {
  return Boolean(q.q) || q.categories.length > 0 || q.minPrice !== null || q.maxPrice !== null;
}

/** One stable string per distinct search, so saving the same search twice is recognised. */
export function serializeSearch(q: ListingQuery): string {
  const p = new URLSearchParams();
  if (q.q) p.set('q', q.q);
  if (q.categories.length) p.set('category', [...q.categories].sort().join(','));
  if (q.minPrice !== null) p.set('minPrice', String(q.minPrice));
  if (q.maxPrice !== null) p.set('maxPrice', String(q.maxPrice));
  return p.toString();
}

/** "calculator" · Electronics · up to ₹500 */
export function describeSearch(q: ListingQuery, names?: Record<string, string>): string {
  const parts: string[] = [];
  if (q.q) parts.push(`“${q.q}”`);
  if (q.categories.length) parts.push([...q.categories].sort().map((c) => categoryLabel(c, names)).join(' + '));
  if (q.minPrice !== null && q.maxPrice !== null) parts.push(`${formatPrice(q.minPrice)} to ${formatPrice(q.maxPrice)}`);
  else if (q.maxPrice !== null) parts.push(`up to ${formatPrice(q.maxPrice)}`);
  else if (q.minPrice !== null) parts.push(`from ${formatPrice(q.minPrice)}`);
  return (parts.join(' · ') || 'Everything').slice(0, 120);
}

/** Saved query string -> the plain object parseListingQuery() expects. */
export function searchParamsObject(query: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(query).entries());
}
