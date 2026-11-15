'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export const UNREAD_REFRESH_EVENT = 'campus:unread-refresh';

export function useUnreadCount(userId: string, initial: number): number {
  const [count, setCount] = useState(initial);
  const pathname = usePathname();
  const instance = useId().replace(/:/g, '');
  const latest = useRef(0);
  const firstRun = useRef(true);

  const refresh = useCallback(async () => {
    const seq = ++latest.current;
    try {
      const { data, error } = await createClient().rpc('get_unread_count');
      if (!error && typeof data === 'number' && seq === latest.current) setCount(data);
    } catch {
    }
  }, []);

  useEffect(() => { setCount(initial); }, [initial]);

  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    void refresh();
  }, [pathname, refresh]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`unread:${instance}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
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
