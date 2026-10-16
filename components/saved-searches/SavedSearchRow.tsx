'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { deleteSavedSearch, markSavedSearchSeen, setSavedSearchAlerts } from '@/lib/saved-searches/actions';

export default function SavedSearchRow({ id, label, href, notify, newCount }: { id: number; label: string; href: string; notify: boolean; newCount: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');

  const run = (fn: () => Promise<{ error?: string }>) => {
    setError('');
    start(async () => {
      const r = await fn();
      if (r.error) setError(r.error); else router.refresh();
    });
  };

  return (
    <li className="saved-row">
      <div className="saved-row-main">
        <p className="saved-row-label">{label}</p>
        {notify
          ? newCount > 0
            ? <p className="saved-row-new"><span className="new-badge">{newCount} NEW</span> since you last looked</p>
            : <p className="saved-row-quiet">No new matches yet</p>
          : <p className="saved-row-quiet">Alerts are off</p>}
      </div>
      <div className="saved-row-actions">
        {/* Opening the results counts as "seen", so the badge restarts. The action runs in the background and navigation is not delayed. */}
        <Link href={href} className="btn btn-dark btn-sm" onClick={() => { if (newCount > 0) void markSavedSearchSeen(id); }}>
          {newCount > 0 ? 'SEE NEW' : 'VIEW'}
        </Link>
        <button type="button" className="btn btn-outline btn-sm" disabled={pending} aria-pressed={notify} onClick={() => run(() => setSavedSearchAlerts(id, !notify))}>
          {notify ? 'ALERTS ON' : 'ALERTS OFF'}
        </button>
        <button type="button" className="btn btn-outline btn-sm" disabled={pending}
          onClick={() => window.confirm('Delete this saved search?') && run(() => deleteSavedSearch(id))}>DELETE</button>
      </div>
      {error && <p className="error-box" role="alert">{error}</p>}
    </li>
  );
}
