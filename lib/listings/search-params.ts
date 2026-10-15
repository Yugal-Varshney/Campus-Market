import { CATEGORIES, MAX_PRICE, PAGE_SIZE, SORTS } from '@/lib/constants';
import type { Category, ListingQuery, SortKey } from '@/types';

type Raw = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * URL (?q=&category=&minPrice=&maxPrice=&sort=&page=&available=) -> a validated query. Never trusts input.
 * `validCategories` is the live list from the database; the built-in list is the fallback.
 */
export function parseListingQuery(sp: Raw, validCategories?: string[]): ListingQuery {
  const validCats = validCategories ?? CATEGORIES.map((c) => c.value);
  const cats = (one(sp.category) ?? '')
    .split(',')
    .filter((c): c is Category => (validCats as string[]).includes(c));
  const num = (v: string | undefined) => {
    if (v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 && n <= MAX_PRICE ? n : null;
  };
  const sort = (one(sp.sort) ?? 'newest') as SortKey;
  const page = Math.floor(Number(one(sp.page)));
  return {
    q: (one(sp.q) ?? '').trim().slice(0, 100),
    categories: Array.from(new Set(cats)),
    minPrice: num(one(sp.minPrice)),
    maxPrice: num(one(sp.maxPrice)),
    sort: SORTS.some((s) => s.value === sort) ? sort : 'newest',
    page: Number.isFinite(page) && page >= 1 && page <= 10000 ? page : 1,
    availableOnly: one(sp.available) !== 'all',
  };
}

export const PAGE = PAGE_SIZE;

/** Builds a /marketplace URL from URL params, skipping empty ones. Shared by pagination, filter pills and category chips. */
export function marketplaceHref(params: Record<string, string | undefined>): string {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v && p.set(k, v));
  const qs = p.toString();
  return qs ? `/marketplace?${qs}` : '/marketplace';
}
