'use client';

import Link from 'next/link';
import { useUnreadCount } from './useUnreadCount';

/** The floating message-icon button, with a live unread badge. */
export default function ChatDock({ userId, initial }: { userId: string; initial: number }) {
  const count = useUnreadCount(userId, initial);
  return (
    <Link href="/messages" className="chat-dock font-display visible" aria-label={count > 0 ? `Open messages, ${count} unread` : 'Open messages'}>
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.55L3 20.5l1.5-5.1A8.5 8.5 0 1 1 21 11.5z" />
      </svg>
      {count > 0 && <span className="badge-count" aria-hidden="true">{count > 9 ? '9+' : count}</span>}
    </Link>
  );
}
