'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/** Fired (e.g. by ChatWindow after opening a chat) to make every unread badge re-ask the database. */
export const UNREAD_REFRESH_EVENT = 'campus:unread-refresh';

/**
 * Live count of unread messages for the signed-in student. The number always comes from the database
 * (get_unread_count). Realtime only tells us WHEN to ask again: a message from someone else arrived, the student
 * moved to another page, came back to the tab, or just opened a chat.
 */
export function useUnreadCount(userId: string, initial: number): number {
  const [count, setCount] = useState(initial);
  const pathname = usePathname();
  const instance = useId().replace(/:/g, '');
  const latest = useRef(0);
  const firstRun = useRef(true);

  const refresh = useCallback(async () => {
    const seq = ++latest.current; // ignore answers that arrive out of order
    try {
      const { data, error } = await createClient().rpc('get_unread_count');
      if (!error && typeof data === 'number' && seq === latest.current) setCount(data);
    } catch {
      /* keep the last known count */
    }
  }, []);

  useEffect(() => { setCount(initial); }, [initial]);

  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; } // the server already gave us the first number
    void refresh();
  }, [pathname, refresh]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`unread:${instance}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        // RLS means we only ever receive messages from chats we are in; our own sends are not "unread".
        if ((payload.new as { sender_id?: string }).sender_id !== userId) void refresh();
      })
      .subscribe();
    const onRefresh = () => { void refresh(); };
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener(UNREAD_REFRESH_EVENT, onRefresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener(UNREAD_REFRESH_EVENT, onRefresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [instance, userId, refresh]);

  return count;
}
