import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { getCurrentUser } from '@/lib/auth/session';
import { getListings, getWishlistIds } from '@/lib/listings/queries';
import { marketplaceHref, parseListingQuery } from '@/lib/listings/search-params';
import { getCategories, getCategoryNames } from '@/lib/categories';
import type { Listing, Paginated } from '@/types';
import Filters from '@/components/marketplace/Filters';
import SortSelect from '@/components/marketplace/SortSelect';
import ProductGrid from '@/components/marketplace/ProductGrid';
import Pagination from '@/components/marketplace/Pagination';
import CategoryChips from '@/components/marketplace/CategoryChips';
import ActiveFilters from '@/components/marketplace/ActiveFilters';
import SaveSearchButton from '@/components/saved-searches/SaveSearchButton';
import { hasSearchCriteria, serializeSearch } from '@/lib/saved-searches/query';
import { isSearchSaved } from '@/lib/saved-searches/queries';

export const metadata: Metadata = { title: 'Marketplace' };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function MarketplacePage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  // These requests are independent; run them together so auth doesn't add a serial round trip.
  const [categories, categoryNames, user] = await Promise.all([getCategories(), getCategoryNames(), getCurrentUser()]);
  const query = parseListingQuery(sp, categories.map((c) => c.value));
  const savable = hasSearchCriteria(query);

  // Listing results, wishlist state and saved-search state do not depend on one another.
  const [result, wishlistIds, saved] = await Promise.all([
    getListings(query).catch((): null => null),
    user ? getWishlistIds(user.id) : Promise.resolve([] as number[]),
    user && savable ? isSearchSaved(serializeSearch(query)) : Promise.resolve(false),
  ]);
  const flat = (k: string) => (Array.isArray(sp[k]) ? (sp[k] as string[])[0] : (sp[k] as string | undefined));
  const keep = { q: flat('q'), category: flat('category'), minPrice: flat('minPrice'), maxPrice: flat('maxPrice'), sort: flat('sort'), available: flat('available') };

  // "Narrowed" = the person asked for something specific. The sold/rented switch alone doesn't count.
  const narrowed = Boolean(query.q) || query.categories.length > 0 || query.minPrice !== null || query.maxPrice !== null;
  const withSold = marketplaceHref({ ...keep, available: 'all', page: undefined });

  return (
    <div className="browse-grid">
      <Suspense fallback={<aside className="browse-sidebar" />}><Filters categories={categories} /></Suspense>
      <section className="browse-main">
        {/* Search is always on the page. The navbar box is hidden on phones and for signed-out visitors. Filters are carried over. */}
        <form className="mobile-search" action="/marketplace" role="search">
          {keep.category && <input type="hidden" name="category" value={keep.category} />}
          {keep.minPrice && <input type="hidden" name="minPrice" value={keep.minPrice} />}
          {keep.maxPrice && <input type="hidden" name="maxPrice" value={keep.maxPrice} />}
          {keep.sort && <input type="hidden" name="sort" value={keep.sort} />}
          {keep.available && <input type="hidden" name="available" value={keep.available} />}
          <input type="search" name="q" className="search-input" defaultValue={keep.q ?? ''} placeholder="Search books, notes, electronics..." aria-label="Search listings" maxLength={100} />
          <button type="submit" className="btn btn-dark btn-sm">SEARCH</button>
        </form>

        <CategoryChips categories={categories} active={query.categories} params={{ ...keep, category: undefined }} />
        <ActiveFilters query={query} categoryNames={categoryNames} />
        {savable && (
          <SaveSearchButton rawQuery={serializeSearch(query)} saved={saved} signedIn={Boolean(user)} loginHref={`/login?next=${encodeURIComponent(marketplaceHref({ ...keep, page: undefined }))}`} />
        )}

        <header className="listings-header">
          <div className="listings-header-left">
            <h1 className="font-display">{query.q ? `RESULTS FOR “${query.q.toUpperCase()}”` : 'LATEST LISTINGS'}</h1>
            <span className="item-count-badge" role="status">{result ? `${result.total} ${result.total === 1 ? 'ITEM' : 'ITEMS'} FOUND` : '—'}</span>
          </div>
          <Suspense fallback={null}><SortSelect /></Suspense>
        </header>

        {!result ? (
          <div className="empty-state solid" role="alert">
            <h2 className="font-display">The board didn&apos;t load</h2>
            <p>Something went wrong while loading listings. Check your connection and try again.</p>
            <div className="empty-actions">
              <Link href={marketplaceHref({ ...keep, page: undefined })} className="btn btn-dark">Try again</Link>
            </div>
          </div>
        ) : result.items.length === 0 && narrowed ? (
          <div className="empty-state">
            <h2 className="font-display">No matches found</h2>
            <p>{query.q ? `Nothing matched “${query.q}” with your current filters.` : 'No listings fit your current filters.'}</p>
            <p>Check the spelling, try fewer words, or remove a filter.</p>
            <div className="empty-actions">
              <Link href={marketplaceHref({ sort: keep.sort })} className="btn btn-dark">Clear filters</Link>
              {query.availableOnly && <Link href={withSold} className="btn btn-outline">Include sold and rented</Link>}
            </div>
          </div>
        ) : result.items.length === 0 ? (
          <div className="empty-state">
            <h2 className="font-display">Nothing on the board yet</h2>
            <p>Be the first to list something for your campus.</p>
            <div className="empty-actions">
              <Link href={user ? '/sell' : '/login?next=/sell'} className="btn btn-dark">Sell an item</Link>
              {query.availableOnly && <Link href={withSold} className="btn btn-outline">Include sold and rented</Link>}
            </div>
          </div>
        ) : (
          <>
            <h2 className="sr-only">Listings</h2>
            <ProductGrid items={result.items} wishlistIds={wishlistIds} categoryNames={categoryNames} />
            <Pagination page={result.page} total={result.total} pageSize={result.pageSize} params={keep} />
          </>
        )}
      </section>
    </div>
  );
}
