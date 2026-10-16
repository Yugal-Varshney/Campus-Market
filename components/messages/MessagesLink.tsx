'use client';

import Link from 'next/link';
import { useUnreadCount } from './useUnreadCount';

const ChatIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

/** Navbar link to the inbox, with a live unread badge. */
export default function MessagesLink({ userId, initial }: { userId: string; initial: number }) {
  const count = useUnreadCount(userId, initial);
  return (
    <Link href="/messages" className="icon-link" aria-label={count > 0 ? `Messages, ${count} unread` : 'Messages'}>
      {count > 0 && <span className="badge-count" aria-hidden="true">{count > 9 ? '9+' : count}</span>}
      <span className="icon-link-label"><ChatIcon /><span>Messages</span></span>
    </Link>
  );
}
