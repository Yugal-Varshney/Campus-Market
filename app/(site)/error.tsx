'use client';

import Link from 'next/link';

/** A page crashed. The navbar and footer stay, so the person can go somewhere else without reloading. */
export default function SiteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="not-found-shell" role="alert">
      <h1 className="font-display">THAT PAGE DIDN&apos;T LOAD</h1>
      <p>Something went wrong on our side. Your listings and messages are safe.</p>
      <div className="empty-actions">
        <button type="button" className="btn btn-dark" onClick={reset}>Try again</button>
        <Link href="/marketplace" className="btn btn-outline">Back to the marketplace</Link>
      </div>
    </div>
  );
}
