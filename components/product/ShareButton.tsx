'use client';

import { useEffect, useState } from 'react';

/** Share a listing: the phone's share sheet when there is one, otherwise copy link + WhatsApp. The message itself carries the title and price. */
export default function ShareButton({ path, title, price }: { path: string; title: string; price: string }) {
  const [canNative, setCanNative] = useState(false);
  const [origin, setOrigin] = useState('');
  const [note, setNote] = useState('');
  useEffect(() => {
    setOrigin(window.location.origin);
    setCanNative(typeof navigator.share === 'function');
  }, []);

  const text = `${title} · ${price} on Campus Market`;
  const url = () => `${origin}${path}`;
  const say = (m: string) => { setNote(m); window.setTimeout(() => setNote(''), 2500); };

  async function copy() {
    try { await navigator.clipboard.writeText(url()); say('Link copied'); } catch { say('Could not copy. Copy the address from your browser instead.'); }
  }
  async function share() {
    try { await navigator.share({ title, text, url: url() }); } catch { /* the person closed the share sheet */ }
  }

  return (
    <div className="share-row" role="group" aria-label="Share this listing">
      {canNative && <button type="button" className="btn btn-outline btn-sm" onClick={share}>SHARE</button>}
      <button type="button" className="btn btn-outline btn-sm" onClick={copy}>COPY LINK</button>
      {!canNative && (
        <a className="btn btn-outline btn-sm" target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url()}`)}`}>
          WHATSAPP<span className="sr-only"> (opens in a new tab)</span>
        </a>
      )}
      <span className="share-note" role="status">{note}</span>
    </div>
  );
}
