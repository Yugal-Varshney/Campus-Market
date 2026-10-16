import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { Conversation, Message } from '@/types';

export async function getConversations(): Promise<Conversation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('conversations')
    .select('id, item_id, buyer_id, seller_id, buyer_name, created_at, items (title, seller_name)')
    .order('created_at', { ascending: false });
  if (error) throw new Error('Unable to load conversations.');
  const rows = data ?? [];

  // Latest message per chat (one query). RLS limits it to chats the person is in. Chats with no recent message
  // in this window simply have no preview and sort by when they were started.
  const last = new Map<number, { body: string; createdAt: string; senderId: string }>();
  if (rows.length) {
    const { data: msgs } = await supabase
      .from('messages')
      .select('conversation_id, sender_id, body, created_at')
      .in('conversation_id', rows.map((c) => c.id))
      .order('created_at', { ascending: false })
      .limit(Math.min(1000, rows.length * 25));
    for (const m of msgs ?? []) {
      if (!last.has(m.conversation_id)) last.set(m.conversation_id, { body: m.body, createdAt: m.created_at, senderId: m.sender_id });
    }
  }

  // When I last opened each chat (RLS: only my own rows). A chat with no row counts from when it was created.
  const readAt = new Map<number, string>();
  if (rows.length) {
    const { data: reads } = await supabase
      .from('conversation_reads')
      .select('conversation_id, last_read_at')
      .in('conversation_id', rows.map((c) => c.id));
    for (const r of reads ?? []) readAt.set(r.conversation_id, r.last_read_at);
  }

  const list = rows.map((c) => {
    const item = c.items as unknown as { title: string; seller_name: string } | null;
    const l = last.get(c.id);
    return {
      id: c.id,
      itemId: c.item_id,
      buyerId: c.buyer_id,
      sellerId: c.seller_id,
      buyerName: c.buyer_name,
      createdAt: c.created_at,
      itemTitle: item?.title ?? 'Removed listing',
      itemSellerName: item?.seller_name ?? 'Seller',
      lastMessage: l?.body ?? null,
      lastMessageAt: l?.createdAt ?? null,
      lastSenderId: l?.senderId ?? null,
      lastReadAt: readAt.get(c.id) ?? null,
    };
  });
  return list.sort((a, b) => Date.parse(b.lastMessageAt ?? b.createdAt) - Date.parse(a.lastMessageAt ?? a.createdAt));
}

/** Initial messages for the open chat; later ones arrive over Realtime. RLS limits this to participants. */
export async function getMessages(conversationId: number): Promise<Message[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('messages')
    .select('id, conversation_id, sender_id, body, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(500);
  if (error) throw new Error('Unable to load messages.');
  return (data ?? []).map((m) => ({
    id: m.id, conversationId: m.conversation_id, senderId: m.sender_id, body: m.body, createdAt: m.created_at,
  }));
}

/** Unread messages from other people across all of the signed-in student's chats (capped at 100). Never throws. One call per request. */
export const getUnreadCount = cache(async (): Promise<number> => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('get_unread_count');
    return !error && typeof data === 'number' ? data : 0;
  } catch {
    return 0;
  }
});
