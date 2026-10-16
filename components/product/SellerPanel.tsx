'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { deleteListing, revealContact, setListingStatus } from '@/lib/listings/actions';
import { sendMessage, startConversation } from '@/lib/messages/actions';
import type { ContactShareStatus, Listing, SellerContact } from '@/types';
import WishlistButton from '@/components/marketplace/WishlistButton';
import ContactCard from '@/components/messages/ContactCard';
import { safely } from '@/lib/safe-action';

const QUICK_MESSAGES = ['Is this still available?', 'Can we meet on campus?', 'Is the price negotiable?'];

/** Owner controls or buyer actions. These checks are UX only — RLS enforces them in the database. */
export default function SellerPanel({ item, isOwner, wishlisted, hasConversations = false, share = null }: { item: Listing; isOwner: boolean; wishlisted: boolean; hasConversations?: boolean; share?: { conversationId: number; status: ContactShareStatus } | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [contact, setContact] = useState<SellerContact | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const done = item.status !== 'active';
  const doneStatus = item.listingType === 'rent' ? 'rented' : 'sold';

  const run = (fn: () => Promise<{ error?: string; success?: string } | void>, okMessage?: string) => {
    setError('');
    setNotice('');
    start(async () => {
      const res = await safely(fn);
      if (res && res.error) setError(res.error);
      else { setNotice(okMessage ?? res?.success ?? ''); router.refresh(); }
    });
  };

  // Opens (or finds) the chat and sends a ready-made first message, so a buyer can reach out in one tap.
  const quickMessage = (text: string) => {
    setError('');
    start(async () => {
      const r = await safely(() => startConversation(item.id));
      if (!r.conversationId) { setError(r.error ?? 'Could not start a chat.'); return; }
      await safely(() => sendMessage(r.conversationId as number, text)); // if this fails the chat still opens and the buyer can type it there
      router.push(`/messages?c=${r.conversationId}`);
    });
  };

  if (isOwner) {
    return (
      <div className="owner-panel">
        <p className="eyebrow">You&apos;re the seller</p>
        <p className="owner-hint">
          {done ? `This listing is marked ${item.status}. Buyers can still see it but can't contact you.` : `Once it's ${doneStatus}, mark it so buyers know.`}
        </p>
        {hasConversations && (
          <p className="owner-hint">This listing has conversations, so it can&apos;t be deleted. Mark it as sold or rented instead — your chats stay intact.</p>
        )}
        <div className="owner-actions">
          {done ? (
            <button type="button" className="btn btn-outline" disabled={pending} onClick={() => run(() => setListingStatus(item.id, 'active'), 'Back on the marketplace. Buyers can contact you again.')}>MARK AVAILABLE AGAIN</button>
          ) : (
            <>
              <button type="button" className="btn btn-dark" disabled={pending} onClick={() => run(() => setListingStatus(item.id, doneStatus), `Marked as ${doneStatus}. It stays visible, but buyers can no longer contact you about it.`)}>
                {item.listingType === 'rent' ? 'MARK AS RENTED OUT' : 'MARK AS SOLD'}
              </button>
              <Link href={`/sell/${item.id}/edit`} className="btn btn-outline">EDIT</Link>
            </>
          )}
          {hasConversations && <Link href="/messages" className="btn btn-outline">VIEW MESSAGES</Link>}
          {!hasConversations && (
            <button type="button" className="btn btn-outline" disabled={pending}
              onClick={() => window.confirm('Delete this listing permanently?') && run(() => deleteListing(item.id))}>DELETE</button>
          )}
        </div>
        {notice && <p className="success-box owner-notice" role="status">{notice}</p>}
        {error && <p className="error-box" role="alert">{error}</p>}
      </div>
    );
  }

  return (
    <>
      {contact && share?.status === 'approved' && <ContactCard contact={contact} />}
      {error && <p className="error-box" role="alert">{error}</p>}
      {!item.sellerId && <p className="owner-hint">This is a demo listing from the showcase, so there is no seller to contact.</p>}
      {item.sellerId && !done && !share && <p className="owner-hint">Start a chat first. In the chat you can ask the seller to share their email and phone number.</p>}
      {!done && share?.status === 'requested' && <p className="owner-hint">You asked the seller to share their contact details. Their answer will appear in your chat.</p>}
      {!done && share?.status === 'declined' && <p className="owner-hint">The seller chose not to share contact details. You can still message them in the chat.</p>}
      {!done && item.sellerId && !share && (
        <div className="quick-messages" role="group" aria-label="Send the seller a quick message">
          <p className="quick-messages-label">Quick message</p>
          <div className="quick-messages-row">
            {QUICK_MESSAGES.map((q) => (
              <button key={q} type="button" className="chip" disabled={pending} onClick={() => quickMessage(q)}>{q}</button>
            ))}
          </div>
        </div>
      )}
      <div className="detail-actions">
        {!done && item.sellerId && (
          <button type="button" className="btn btn-primary" disabled={pending}
            onClick={() => { setError(''); start(async () => { const r = await safely(() => startConversation(item.id)); if (r.conversationId) router.push(`/messages?c=${r.conversationId}`); else setError(r.error ?? 'Could not start a chat.'); }); }}>
            {share ? 'OPEN CHAT' : 'CHAT WITH SELLER'}
          </button>
        )}
        {!done && share?.status === 'approved' && !contact && (
          <button type="button" className="btn btn-outline" disabled={pending}
            onClick={() => { setError(''); start(async () => { const r = await safely(() => revealContact(item.id)); if (r.contact) setContact(r.contact); else setError(r.error ?? 'Contact details are unavailable right now.'); }); }}>
            VIEW CONTACT DETAILS
          </button>
        )}
        <WishlistButton itemId={item.id} initial={wishlisted} className="detail-wishlist-btn" />
      </div>
    </>
  );
}