import Link from 'next/link';
import { categoryLabel } from '@/lib/constants';
import { formatPrice } from '@/lib/format';
import { marketplaceHref } from '@/lib/listings/search-params';
import type { ListingQuery } from '@/types';

type P = Record<string, string | undefined>;

/** Everything that is narrowing the results right now, each with a one-click remove. Plain links, so no JavaScript is needed. */
export default function ActiveFilters({ query, categoryNames }: { query: ListingQuery; categoryNames?: Record<string, string> }) {
  const base: P = {
    q: query.q || undefined,
    category: query.categories.join(',') || undefined,
    minPrice: query.minPrice !== null ? String(query.minPrice) : undefined,
    maxPrice: query.maxPrice !== null ? String(query.maxPrice) : undefined,
    sort: query.sort !== 'newest' ? query.sort : undefined,
    available: query.availableOnly ? undefined : 'all',
  };
  const pills: { key: string; label: string; href: string; aria?: string }[] = [];
  if (base.q) pills.push({ key: 'q', label: `“${query.q}”`, aria: 'Remove search text', href: marketplaceHref({ ...base, q: undefined }) });
  for (const c of query.categories) {
    const rest = query.categories.filter((x) => x !== c).join(',') || undefined;
    pills.push({ key: `c-${c}`, label: categoryLabel(c, categoryNames), href: marketplaceHref({ ...base, category: rest }) });
  }
  if (query.minPrice !== null) pills.push({ key: 'min', label: `From ${formatPrice(query.minPrice)}`, href: marketplaceHref({ ...base, minPrice: undefined }) });
  if (query.maxPrice !== null) pills.push({ key: 'max', label: `Up to ${formatPrice(query.maxPrice)}`, href: marketplaceHref({ ...base, maxPrice: undefined }) });
  if (!query.availableOnly) pills.push({ key: 'all', label: 'Sold & rented shown', href: marketplaceHref({ ...base, available: undefined }) });
  if (pills.length === 0) return null;

  return (
    <div className="active-filters" role="group" aria-label="Active filters">
      <ul>
        {pills.map((p) => (
          <li key={p.key}>
            <Link href={p.href} className="filter-pill" aria-label={p.aria ?? `Remove filter: ${p.label}`}>
              {p.label} <span aria-hidden="true">×</span>
            </Link>
          </li>
        ))}
      </ul>
      <Link href={marketplaceHref({ sort: base.sort })} className="hero-link">Clear all</Link>
    </div>
  );
}
