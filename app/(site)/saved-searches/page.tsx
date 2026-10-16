import type { Metadata } from 'next';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth/session';
import { getSavedSearches, type SavedSearch } from '@/lib/saved-searches/queries';
import SavedSearchRow from '@/components/saved-searches/SavedSearchRow';

export const metadata: Metadata = { title: 'Saved searches' };

export default async function SavedSearchesPage() {
  const user = await getCurrentUser();
  if (!user) return <div className="empty-state solid" role="alert"><h2 className="font-display">Sign in</h2><p>You need to sign in to continue.</p></div>;

  let rows: SavedSearch[] | null = null;
  try { rows = await getSavedSearches(user.id); } catch { rows = null; }
  const totalNew = rows?.reduce((n, r) => n + r.newCount, 0) ?? 0;

  return (
    <div className="messages-shell">
      <header className="listings-header" style={{ marginBottom: '1.5rem' }}>
        <div className="listings-header-left">
          <h1 className="font-display">SAVED SEARCHES</h1>
          <span className="item-count-badge" role="status">{rows ? (totalNew > 0 ? `${totalNew} NEW` : `${rows.length} SAVED`) : '—'}</span>
        </div>
      </header>
      <p className="saved-intro">Save a search on the marketplace and we&apos;ll count new matches here and on the Alerts icon. Up to 10 searches.</p>
      {!rows ? (
        <div className="empty-state solid" role="alert"><h2 className="font-display">Couldn&apos;t load</h2><p>Unable to load your saved searches. Please refresh the page.</p></div>
      ) : rows.length === 0 ? (
        <div className="empty-state" style={{ padding: '4rem 1rem' }}>
          <h2 className="font-display">NO SAVED SEARCHES YET</h2>
          <p>Search for something, then tap &ldquo;Save this search&rdquo;. Looking for a textbook that isn&apos;t listed yet? This is how you catch it.</p>
          <div className="empty-actions"><Link href="/marketplace" className="btn btn-dark">Browse the board</Link></div>
        </div>
      ) : (
        <ul className="saved-list">
          {rows.map((r) => (
            <SavedSearchRow key={r.id} id={r.id} label={r.label} href={r.query ? `/marketplace?${r.query}` : '/marketplace'} notify={r.notify} newCount={r.newCount} />
          ))}
        </ul>
      )}
    </div>
  );
}
