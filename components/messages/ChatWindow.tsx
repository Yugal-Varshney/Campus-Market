'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { sendMessage } from '@/lib/messages/actions';
import type { ContactShareStatus, Message } from '@/types';
import ReportButton from '@/components/report/ReportButton';
import ContactPanel from './ContactPanel';
import MessageBubble from './MessageBubble';
import { UNREAD_REFRESH_EVENT } from './useUnreadCount';
import { safely } from '@/lib/safe-action';

const BUYER_STARTERS = ['Is this still available?', 'Where on campus can we meet?', 'Is the price negotiable?'];
const SELLER_STARTERS = ['Yes, it is still available.', 'Where would you like to meet?', 'Can you come by this evening?'];

interface Props {
  conversationId: number; userId: string; title: string; otherParty: string; itemId: number; initialMessages: Message[];
  isBuyer: boolean; otherUserId: string; initialShare: ContactShareStatus | null;
}

/** Messages arrive over Supabase Realtime (postgres_changes) — no polling. RLS decides who receives each row. */
export default function ChatWindow({ conversationId, userId, title, otherParty, itemId, initialMessages, isBuyer, otherUserId, initialShare }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [live, setLive] = useState(true);
  const [tick, setTick] = useState(0);
  const [pending, start] = useTransition();
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const add = (m: Message) => setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));

  // Tell the database this chat has been seen, then make the unread badges re-count.
  const markRead = useCallback(() => {
    createClient()
      .rpc('mark_conversation_read', { p_conversation_id: conversationId })
      .then(() => window.dispatchEvent(new Event(UNREAD_REFRESH_EVENT)), () => {});
  }, [conversationId]);

  useEffect(() => {
    markRead(); // opening the chat counts as reading it
    const onVisible = () => { if (document.visibilityState === 'visible') markRead(); }; // came back to this tab
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [markRead]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`chat:${conversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const r = payload.new as { id: number; conversation_id: number; sender_id: string; body: string; created_at: string };
          add({ id: r.id, conversationId: r.conversation_id, senderId: r.sender_id, body: r.body, createdAt: r.created_at });
          setTick((t) => t + 1); // a new message is a good moment to re-read the contact-request state
          if (r.sender_id !== userId && document.visibilityState === 'visible') markRead(); // they are looking at it right now
        })
      .subscribe((status) => setLive(status !== 'CHANNEL_ERROR' && status !== 'TIMED_OUT'));
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, userId, markRead]);

  useEffect(() => { threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight }); }, [messages.length]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setError('');
    start(async () => {
      const res = await safely(() => sendMessage(conversationId, body));
      if (res.message) { add(res.message); setDraft(''); } else setError(res.error ?? 'Message could not be sent.');
    });
  };

  return (
    <div className="chat-panel">
      <header className="chat-panel-header">
        <div style={{ minWidth: 0 }}>
          <h2 className="font-display">{title}</h2>
          <p className="subtitle">Chatting with {otherParty}</p>
        </div>
        <Link href={`/marketplace/${itemId}`} className="view-link font-mono">View listing</Link>
      </header>
      <ContactPanel conversationId={conversationId} itemId={itemId} isBuyer={isBuyer} otherParty={otherParty} initialStatus={initialShare} refreshTick={tick} />
      <div className="chat-report-row"><ReportButton userId={otherUserId} label="Report this user" /></div>
      <div className="chat-thread" ref={threadRef} role="log" aria-live="polite" aria-label="Messages">
        {messages.length === 0
          ? (
            <div className="chat-empty">
              <p>Say hi — ask about pickup, condition, or a better price.</p>
              <div className="quick-messages-row" role="group" aria-label="Suggested messages">
                {(isBuyer ? BUYER_STARTERS : SELLER_STARTERS).map((q) => (
                  <button key={q} type="button" className="chip" onClick={() => { setDraft(q); inputRef.current?.focus(); }}>{q}</button>
                ))}
              </div>
            </div>
          )
          : messages.map((m) => <MessageBubble key={m.id} message={m} mine={m.senderId === userId} />)}
      </div>
      {!live && <p className="field-hint" role="status" style={{ padding: '0 1rem' }}>Live updates are unavailable — refresh to see new messages.</p>}
      {error && <p className="error-box" role="alert">{error}</p>}
      <form className="chat-input-row" onSubmit={submit}>
        <input ref={inputRef} type="text" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ask about pickup, condition, bargaining…" maxLength={1000} aria-label="Message" />
        <button type="submit" className="btn btn-dark" disabled={pending}>Send</button>
      </form>
    </div>
  );
}
