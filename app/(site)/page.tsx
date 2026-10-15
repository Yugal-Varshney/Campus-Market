import type { Metadata } from 'next';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth/session';
import { getListings, getWishlistIds } from '@/lib/listings/queries';
import { parseListingQuery } from '@/lib/listings/search-params';
import { getCategories, getCategoryNames } from '@/lib/categories';
import type { Listing } from '@/types';
import ProductGrid from '@/components/marketplace/ProductGrid';

export const metadata: Metadata = { title: { absolute: 'Campus Market · Buy, sell and rent on campus' } };

const HOME_LISTINGS = 8;

/** Home page: a compact hero (search + categories + two actions) with real listings right underneath it. */
export default async function Home() {
  const [user, categories, categoryNames] = await Promise.all([getCurrentUser(), getCategories(), getCategoryNames()]);
  const browsingOpen = process.env.REQUIRE_LOGIN_TO_BROWSE === 'false';
  const canSeeListings = Boolean(user) || browsingOpen;

  let items: Listing[] | null = null;
  if (canSeeListings) {
    try {
      items = (await getListings(parseListingQuery({}, categories.map((c) => c.value)))).items.slice(0, HOME_LISTINGS);
    } catch {
      items = null;
    }
  }
  const wishlistIds = user ? await getWishlistIds(user.id) : [];

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
                <Link href="/register" className="btn btn-dark">Create account</Link>
                <Link href="/login" className="hero-link">Already a member? Sign in →</Link>
              </>
            )}
          </div>
        </div>
      </section>

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
