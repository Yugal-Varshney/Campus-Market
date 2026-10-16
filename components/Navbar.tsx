import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth/session';
import { getActingRole } from '@/lib/staff/auth';
import { getWishlistIds } from '@/lib/listings/queries';
import { getAlertCount } from '@/lib/saved-searches/queries';
import UserMenu from './UserMenu';

const HeartIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" />
  </svg>
);

const BellIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

export default async function Navbar() {
  const user = await getCurrentUser();
  const [wishlistCount, role, alertCount] = user
    ? await Promise.all([getWishlistIds(user.id).then((ids) => ids.length), getActingRole(), getAlertCount(user.id)])
    : [0, 'student' as const, 0];

  return (
    <nav className="navbar" aria-label="Main">
      <div className="navbar-inner">
        <div className="navbar-left">
          <Link href="/" className="brand font-display">Campus Market</Link>
          {user && (
            <form className="search-form" action="/marketplace" role="search">
              <div className="search-wrap">
                <input type="search" name="q" className="search-input" placeholder="Search books, notes, electronics..." aria-label="Search listings" maxLength={100} />
              </div>
            </form>
          )}
        </div>
        <div className="navbar-right">
          {user ? (
            <>
              <Link href="/wishlist" className="icon-link" aria-label={`Wishlist, ${wishlistCount} saved`}>
                {wishlistCount > 0 && <span className="badge-count">{wishlistCount}</span>}
                <span className="icon-link-label"><HeartIcon /><span>Wishlist</span></span>
              </Link>
              <Link href="/saved-searches" className="icon-link" aria-label={alertCount > 0 ? `Alerts, ${alertCount} new` : 'Alerts and saved searches'}>
                {alertCount > 0 && <span className="badge-count">{alertCount > 9 ? '9+' : alertCount}</span>}
                <span className="icon-link-label"><BellIcon /><span>Alerts</span></span>
              </Link>
              <Link href="/sell" className="btn btn-dark">Sell an Item</Link>
              <UserMenu email={user.email} name={user.displayName} role={role} />
            </>
          ) : (
            <Link href="/login" className="signin-link">Sign in</Link>
          )}
        </div>
      </div>
    </nav>
  );
}
