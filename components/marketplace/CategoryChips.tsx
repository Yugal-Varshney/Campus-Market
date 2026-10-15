import Link from 'next/link';
import { marketplaceHref } from '@/lib/listings/search-params';
import type { CategoryOption } from '@/types';

/** One-tap category switcher above the results. Keeps the search text, price, sort and sold setting; resets the page. */
export default function CategoryChips({ categories, active, params }: { categories: CategoryOption[]; active: string[]; params: Record<string, string | undefined> }) {
  const base = { ...params, category: undefined, page: undefined };
  return (
    <nav aria-label="Categories">
      <ul className="cat-chips">
        <li><Link href={marketplaceHref(base)} className={`chip${active.length === 0 ? ' is-active' : ''}`} aria-current={active.length === 0 ? 'true' : undefined}>All</Link></li>
        {categories.map((c) => {
          const on = active.includes(c.value);
          return (
            <li key={c.value}>
              <Link href={marketplaceHref({ ...base, category: c.value })} className={`chip${on ? ' is-active' : ''}`} aria-current={on ? 'true' : undefined}>{c.label}</Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
