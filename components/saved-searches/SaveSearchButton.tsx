'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { saveSearch } from '@/lib/saved-searches/actions';
import { safely } from '@/lib/safe-action';

/** "Save this search" for the current filters. Signed-out visitors are sent to sign in and brought back here. */
export default function SaveSearchButton({ rawQuery, saved, signedIn, loginHref }: { rawQuery: string; saved: boolean; signedIn: boolean; loginHref: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  if (!signedIn) return <Link href={loginHref} className="save-search-link">Sign in to save this search and get alerts</Link>;
  if (saved) return <Link href="/saved-searches" className="save-search-link is-saved"><span aria-hidden="true">★</span> Search saved · manage alerts</Link>;

  const save = () => {
    setError('');
    start(async () => {
      const r = await safely(() => saveSearch(rawQuery));
      if (r.error) setError(r.error);
      else { setMessage(r.success ?? 'Search saved.'); router.refresh(); }
    });
  };

  return (
    <div className="save-search">
      <button type="button" className="btn btn-outline btn-sm" disabled={pending} onClick={save}>
        <span aria-hidden="true">☆</span> {pending ? 'SAVING…' : 'SAVE THIS SEARCH'}
      </button>
      <p className="save-search-hint">Get an alert when something new matches.</p>
      <p className="sr-only" role="status">{message}</p>
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  );
}
