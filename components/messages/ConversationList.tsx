import Link from 'next/link';
import { timeAgo } from '@/lib/format';
import type { Conversation } from '@/types';

/** Unread = the newest message is from the other person and arrived after I last opened the chat. */
function isUnread(c: Conversation, userId: string): boolean {
  if (!c.lastMessageAt || !c.lastSenderId || c.lastSenderId === userId) return false;
  return Date.parse(c.lastMessageAt) > Date.parse(c.lastReadAt ?? c.createdAt);
}

export default function ConversationList({ conversations, activeId, userId, pendingIds = [] }: { conversations: Conversation[]; activeId: number | null; userId: string; pendingIds?: number[] }) {
  return (
    <div className="conversation-list-wrap">
      <div className="conversation-list-header">{conversations.length} {conversations.length === 1 ? 'conversation' : 'conversations'}</div>
      <ul className="conversation-list">
        {conversations.length === 0 && <li><p className="conversation-empty">No chats yet — message a seller from any listing to get started.</p></li>}
        {conversations.map((c) => {
          const unread = c.id !== activeId && isUnread(c, userId); // the open chat is being read right now
          return (
          <li key={c.id}>
            <Link href={`/messages?c=${c.id}`} className={`conversation-item${c.id === activeId ? ' active' : ''}${unread ? ' unread' : ''}`} aria-current={c.id === activeId ? 'true' : undefined} style={{ display: 'block' }}>
              {unread && <><span className="unread-dot" aria-hidden="true" /><span className="sr-only">Unread. </span></>}
              <p className="title">{c.itemTitle}</p>
              <p className="subtitle">Chatting with {c.buyerId === userId ? c.itemSellerName : c.buyerName}</p>
              {c.lastMessage && <p className="preview">{c.lastSenderId === userId ? 'You: ' : ''}{c.lastMessage}</p>}
              <p className="time font-mono" suppressHydrationWarning>{timeAgo(c.lastMessageAt ?? c.createdAt)}</p>
              {pendingIds.includes(c.id) && <span className="conv-tag">Contact request</span>}
            </Link>
          </li>
          );
        })}
      </ul>
    </div>
  );
}
