'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { answerContactRequest, getShareStatus, requestContact, stopSharingContact } from '@/lib/contact/actions';
import { revealContact } from '@/lib/listings/actions';
import type { ContactShareStatus, SellerContact } from '@/types';

interface Props {
  conversationId: number;
  itemId: number;
  isBuyer: boolean;
  otherParty: string;
  initialStatus: ContactShareStatus | null;
  /** Bumped by the chat when a new message arrives, so the request state is re-read right away. */
  refreshTick: number;
}

/** The seller decides who gets their email and phone. The database enforces it; this is the screen for it. */
export default function ContactPanel({ conversationId, itemId, isBuyer, otherParty, initialStatus, refreshTick }: Props) {
  const [status, setStatus] = useState<ContactShareStatus | null>(initialStatus);
  const [contact, setContact] = useState<SellerContact | null>(null);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  const refresh = useCallback(async () => {
    const res = await getShareStatus(conversationId);
    if (!res.error) setStatus(res.status ?? null);
  }, [conversationId]);

  useEffect(() => { if (refreshTick > 0) void refresh(); }, [refreshTick, refresh]);
  useEffect(() => {
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 15000);
    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', onFocus); };
  }, [refresh]);

  const act = (fn: () => Promise<{ status?: ContactShareStatus | null; error?: string }>) => {
    setError('');
    start(async () => {
      const res = await fn();
      if (res.error) setError(res.error);
      else setStatus(res.status ?? null);
    });
  };

  const reveal = () => {
    setError('');
    start(async () => {
      const r = await revealContact(itemId);
      if (r.contact) setContact(r.contact);
      else setError(r.error ?? 'Contact details are unavailable right now.');
    });
  };

  // Sellers only see this bar when there is something to act on.
  if (!isBuyer && status !== 'requested' && status !== 'approved') return null;

  return (
    <div className="contact-bar" role="region" aria-label="Contact details">
      {isBuyer && (status === null || status === 'declined' || status === 'revoked') && (
        <>
          <p>
            {status === 'declined' && `${otherParty} chose not to share contact details. You can ask again after 24 hours, or keep chatting here.`}
            {status === 'revoked' && `${otherParty} stopped sharing contact details. You can ask again.`}
            {status === null && `Want to talk outside the app? Ask ${otherParty} to share their email and phone number.`}
          </p>
          <div className="contact-bar-actions">
            <button type="button" className="btn btn-outline btn-sm" disabled={pending} onClick={() => act(() => requestContact(conversationId))}>ASK FOR CONTACT DETAILS</button>
          </div>
        </>
      )}
      {isBuyer && status === 'requested' && <p>Request sent. {otherParty} will see it and can approve or decline.</p>}
      {isBuyer && status === 'approved' && (
        <>
          <p>{otherParty} shared their contact details with you.</p>
          {!contact && (
            <div className="contact-bar-actions">
              <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={reveal}>VIEW CONTACT DETAILS</button>
            </div>
          )}
          {contact && (
            <div className="contact-card">
              <p className="contact-line"><span>Name</span><strong>{contact.name}</strong></p>
              {contact.email && <p className="contact-line"><span>Email</span><a href={`mailto:${contact.email}`}>{contact.email}</a></p>}
              {contact.phone && <p className="contact-line"><span>Phone</span><a href={`tel:${contact.phone.replace(/[^\d+]/g, '')}`}>{contact.phone}</a></p>}
              <p className="contact-note">Meet on campus and check the item before paying.</p>
            </div>
          )}
        </>
      )}
      {!isBuyer && status === 'requested' && (
        <>
          <p>{otherParty} asked you to share your college email and phone number. Only approve if you are comfortable.</p>
          <div className="contact-bar-actions">
            <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={() => act(() => answerContactRequest(conversationId, true))}>APPROVE</button>
            <button type="button" className="btn btn-outline btn-sm" disabled={pending} onClick={() => act(() => answerContactRequest(conversationId, false))}>DECLINE</button>
          </div>
        </>
      )}
      {!isBuyer && status === 'approved' && (
        <>
          <p>You are sharing your contact details with {otherParty}. Stopping will not hide anything they already saw.</p>
          <div className="contact-bar-actions">
            <button type="button" className="btn btn-outline btn-sm" disabled={pending} onClick={() => act(() => stopSharingContact(conversationId))}>STOP SHARING</button>
          </div>
        </>
      )}
      {error && <p className="error-box" role="alert">{error}</p>}
    </div>
  );
}
