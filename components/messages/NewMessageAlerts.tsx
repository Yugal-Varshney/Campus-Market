'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUnreadCount } from './useUnreadCount';

type MessageToast = { conversationId: number; itemTitle: string };

const MAX_TOASTS = 3;
const SHOW_MS = 7000;
const COUNT_PREFIX = /^\(\d+\+?\)\s/; // "(3) " in front of the page title

/**
 * Two ways to notice a new message while you are elsewhere on the site:
 *   1. the browser tab title gets an unread count, e.g. "(2) Campus Market", which also shows when the tab is in the background;
 *   2. a small toast "New message about <listing>" that links straight to the chat.
 * No toast when you are already looking at that chat, and none while the tab is hidden (the title covers that).
 */
export default function NewMessageAlerts({ userId, initial }: { userId: string; initial: number }) {
  const count = useUnreadCount(userId, initial);
  const [toasts, setToasts] = useState<MessageToast[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  // ── 1. tab title ────────────────────────────────────────────────────────────
  useEffect(() => {
    const prefix = count > 0 ? `(${count > 99 ? '99+' : count}) ` : '';
    const apply = () => {
      const next = prefix + document.title.replace(COUNT_PREFIX, '');
      if (document.title !== next) document.title = next;
    };
    apply();
    // Next.js rewrites the title on every page change, so re-apply the prefix whenever <head> changes.
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      document.title = document.title.replace(COUNT_PREFIX, '');
    };
  }, [count]);

  // ── 2. toast ────────────────────────────────────────────────────────────────
  const dismiss = useCallback((conversationId: number) => {
    clearTimeout(timers.current.get(conversationId));
    timers.current.delete(conversationId);
    setToasts((prev) => prev.filter((t) => t.conversationId !== conversationId));
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('new-message-toasts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        const m = payload.new as { conversation_id: number; sender_id: string };
        if (m.sender_id === userId || document.visibilityState !== 'visible') return;
        const viewing =
          window.location.pathname === '/messages' &&
          new URLSearchParams(window.location.search).get('c') === String(m.conversation_id);
        if (viewing) return;

        const { data } = await supabase.from('conversations').select('items (title)').eq('id', m.conversation_id).maybeSingle();
        const itemTitle = data?.items?.title ?? 'your listing';

        // One toast per chat: a burst of messages replaces it instead of stacking.
        setToasts((prev) => [...prev.filter((t) => t.conversationId !== m.conversation_id), { conversationId: m.conversation_id, itemTitle }].slice(-MAX_TOASTS));
        clearTimeout(timers.current.get(m.conversation_id));
        timers.current.set(m.conversation_id, setTimeout(() => dismiss(m.conversation_id), SHOW_MS));
      })
      .subscribe();
    const pending = timers.current;
    return () => {
      supabase.removeChannel(channel);
      pending.forEach((t) => clearTimeout(t));
      pending.clear();
    };
  }, [userId, dismiss]);

  return (
    <div className="toast-container toast-messages" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.conversationId} className="toast info toast-message">
          <Link href={`/messages?c=${t.conversationId}`} onClick={() => dismiss(t.conversationId)}>
            <strong>New message</strong>
            <span>about {t.itemTitle}</span>
          </Link>
          <button type="button" className="toast-close" aria-label="Dismiss notification" onClick={() => dismiss(t.conversationId)}>×</button>
        </div>
      ))}
    </div>
  );
}
