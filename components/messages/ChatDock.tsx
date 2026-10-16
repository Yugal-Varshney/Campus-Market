'use client';

import Link from 'next/link';
import { useUnreadCount } from './useUnreadCount';

/** The floating CHAT button, with a live unread badge. */
export default function ChatDock({ userId, initial }: { userId: string; initial: number }) {
  const count = useUnreadCount(userId, initial);
  return (
    <Link href="/messages" className="chat-dock font-display visible" aria-label={count > 0 ? `Open messages, ${count} unread` : 'Open messages'}>
      CHAT
      {count > 0 && <span className="badge-count" aria-hidden="true">{count > 9 ? '9+' : count}</span>}
    </Link>
  );
}
