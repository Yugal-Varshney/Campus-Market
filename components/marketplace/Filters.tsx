'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { PRICE_SLIDER_MAX } from '@/lib/constants';
import { formatPrice } from '@/lib/format';
import type { CategoryOption } from '@/types';

/** Filters live in the URL (?category=&maxPrice=) so results are server-rendered, shareable and paginated. */
export default function Filters({ categories }: { categories: CategoryOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false); // phones only: the panel is collapsed behind a "Filters" button

  const selected = (params.get('category') ?? '').split(',').filter(Boolean);
  const urlMax = params.get('maxPrice');
  const includeSold = params.get('available') === 'all';
  const [max, setMax] = useState(urlMax ? Math.min(Number(urlMax), PRICE_SLIDER_MAX) : PRICE_SLIDER_MAX);
  const first = useRef(true);
  const activeCount = selected.length + (urlMax ? 1 : 0) + (includeSold ? 1 : 0);

  const push = (mutate: (p: URLSearchParams) => void) => {
    const p = new URLSearchParams(params.toString());
    mutate(p);
    p.delete('page');
    const qs = p.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  };

  // Debounce the slider so dragging doesn't fire a query per pixel; skip it when the URL already says the same thing.
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const target = max >= PRICE_SLIDER_MAX ? null : String(max);
    if ((urlMax ?? null) === target) return;
    const t = setTimeout(() => push((p) => (target === null ? p.delete('maxPrice') : p.set('maxPrice', target))), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [max]);

  useEffect(() => { // keep slider in sync when "Clear filters" resets the URL
    setMax(urlMax ? Math.min(Number(urlMax), PRICE_SLIDER_MAX) : PRICE_SLIDER_MAX);
  }, [urlMax]);

  const toggle = (value: string) =>
    push((p) => {
      const next = selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value];
      if (next.length) p.set('category', next.join(',')); else p.delete('category');
    });

  // Clears the filters but keeps what the person typed in search and their sort order.
  const clearAll = () => push((p) => { p.delete('category'); p.delete('minPrice'); p.delete('maxPrice'); p.delete('available'); });

  return (
    <aside className="browse-sidebar" aria-label="Filters" aria-busy={pending}>
      <button type="button" className="filters-toggle" aria-expanded={open} aria-controls="filters-panel" onClick={() => setOpen((o) => !o)}>
        <span>Filters</span>
        {activeCount > 0 && <span className="filters-count" aria-label={`${activeCount} active`}>{activeCount}</span>}
      </button>
      <div id="filters-panel" className={`sidebar-sticky${open ? ' is-open' : ''}${pending ? ' is-pending' : ''}`}>
        <section>
          <h3 className="filter-section-title">Category</h3>
          <div className="filter-list">
            {categories.map((c) => (
              <label key={c.value} className="checkbox-row">
                <input type="checkbox" checked={selected.includes(c.value)} onChange={() => toggle(c.value)} />
                <span>{c.label}</span>
              </label>
            ))}
          </div>
        </section>
        <section>
          <h3 className="filter-section-title">Availability</h3>
          <label className="checkbox-row">
            <input type="checkbox" checked={includeSold} onChange={() => push((p) => (includeSold ? p.delete('available') : p.set('available', 'all')))} />
            <span>Include sold and rented</span>
          </label>
        </section>
        <section>
          <h3 className="filter-section-title"><label htmlFor="price-range">Price Range</label></h3>
          <div className="price-range-wrap">
            <input id="price-range" type="range" min={0} max={PRICE_SLIDER_MAX} step={50} value={max}
              onChange={(e) => setMax(Number(e.target.value))} aria-valuetext={max >= PRICE_SLIDER_MAX ? 'No maximum' : `Up to ${formatPrice(max)}`} />
            <div className="price-range-labels">
              <span>₹0</span>
              <span className="current">{max >= PRICE_SLIDER_MAX ? 'any price' : `up to ${formatPrice(max)}`}</span>
              <span>₹5,000+</span>
            </div>
          </div>
        </section>
        {activeCount > 0 && <button type="button" className="filters-clear" onClick={clearAll}>Clear filters</button>}
      </div>
    </aside>
  );
}
