import type { Metadata } from 'next';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth/session';
import { getListings, getTrendingListings, getWishlistIds } from '@/lib/listings/queries';
import { parseListingQuery } from '@/lib/listings/search-params';
import { getCategories, getCategoryNames } from '@/lib/categories';
import { getPopularSearches } from '@/lib/saved-searches/queries';
import { describeSearch, searchParamsObject } from '@/lib/saved-searches/query';
import type { Listing } from '@/types';
import ProductGrid from '@/components/marketplace/ProductGrid';

export const metadata: Metadata = { title: { absolute: 'Campus Market · Buy, sell and rent on campus' } };

const HOME_LISTINGS = 8;

/** Home page: a compact hero (search + categories + two actions) with real listings right underneath it. */
export default async function Home() {
  const [user, categories, categoryNames] = await Promise.all([getCurrentUser(), getCategories(), getCategoryNames()]);
  const browsingOpen = process.env.REQUIRE_LOGIN_TO_BROWSE === 'false';
  const canSeeListings = Boolean(user) || browsingOpen;

  // Load the independent homepage sections together instead of making visitors wait for each section in turn.
  const itemsPromise: Promise<Listing[] | null> = canSeeListings
    ? getListings(parseListingQuery({}, categories.map((c) => c.value)))
        .then((result) => result.items.slice(0, HOME_LISTINGS))
        .catch(() => null)
    : Promise.resolve(null);
  const [items, wishlistIds, trending, popular] = await Promise.all([
    itemsPromise,
    user ? getWishlistIds(user.id) : Promise.resolve([] as number[]),
    canSeeListings ? getTrendingListings(4) : Promise.resolve([]),
    canSeeListings ? getPopularSearches(5) : Promise.resolve([]),
  ]);

  // Demand signals from real students: what is being saved and messaged about, and what several people are waiting for.
  const validCategories = categories.map((c) => c.value);
  const wanted = popular.map((p) => ({
    href: `/marketplace?${p.query}`,
    label: describeSearch(parseListingQuery(searchParamsObject(p.query), validCategories), categoryNames),
  }));

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-inner">
          <p className="hero-eyebrow">Students only · meet on campus</p>
          <h1 id="hero-title" className="hero-title font-display">
            Buy, sell and rent <span>on campus</span>
          </h1>
          <p className="hero-lead">Textbooks, notes, electronics and stationery from students at your college.</p>

          <form className="hero-search" action="/marketplace" role="search">
            <input type="search" name="q" className="search-input" placeholder="Search books, notes, electronics..." aria-label="Search listings" maxLength={100} />
            <button type="submit" className="btn btn-primary">Search</button>
          </form>

          <ul className="hero-chips" aria-label="Browse by category">
            {categories.map((c) => (
              <li key={c.value}>
                <Link href={`/marketplace?category=${encodeURIComponent(c.value)}`} className="chip">{c.label}</Link>
              </li>
            ))}
          </ul>

          <div className="hero-actions">
            {user ? (
              <>
                <Link href="/sell" className="btn btn-dark">Sell an item</Link>
                <Link href="/marketplace" className="hero-link">Browse everything →</Link>
              </>
            ) : (
              <>
                <Link href="/register" className="btn btn-primary btn-cta">Create account</Link>
                <Link href="/login" className="hero-link">Already a member? Sign in →</Link>
              </>
            )}
          </div>
        </div>
      </section>

      {(trending.length > 0 || wanted.length > 0) && (
        <section className="home-latest home-trending" aria-labelledby="trending-title">
          <header className="home-latest-head">
            <h2 id="trending-title" className="font-display">Popular on campus</h2>
          </header>
          {wanted.length > 0 && (
            <div className="wanted-row">
              <p className="wanted-label">Students are looking for</p>
              <ul className="hero-chips" aria-label="Searches several students saved">
                {wanted.map((w) => <li key={w.href}><Link href={w.href} className="chip">{w.label}</Link></li>)}
              </ul>
            </div>
          )}
          {trending.length > 0 && <ProductGrid items={trending} wishlistIds={wishlistIds} cols={4} categoryNames={categoryNames} />}
        </section>
      )}

      <section className="home-latest" aria-labelledby="latest-title">
        {canSeeListings ? (
          <>
            <header className="home-latest-head">
              <h2 id="latest-title" className="font-display">Latest listings</h2>
              <Link href="/marketplace" className="hero-link">See all →</Link>
            </header>
            {items === null ? (
              <div className="empty-state solid" role="alert">
                <h2 className="font-display">The board didn&apos;t load</h2>
                <p>Unable to load listings. Please refresh the page.</p>
              </div>
            ) : items.length === 0 ? (
              <div className="empty-state">
                <h2 className="font-display">Nothing on the board yet</h2>
                <p>Be the first to list something for your campus.</p>
                <Link href="/sell" className="btn btn-outline">Sell an item</Link>
              </div>
            ) : (
              <ProductGrid items={items} wishlistIds={wishlistIds} cols={4} categoryNames={categoryNames} />
            )}
          </>
        ) : (
          <div className="empty-state solid">
            <h2 id="latest-title" className="font-display">Sign in to see what&apos;s for sale</h2>
            <p>Campus Market is for students only. Use your college email to browse, save and message sellers.</p>
            <Link href="/login?next=/marketplace" className="btn btn-dark">Sign in to browse</Link>
          </div>
        )}
      </section>
    </>
  );
}
