import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { ContactShareStatus } from '@/types';

/**
 * Contact-sharing state (migration 010). These reads never throw: if the table is unreachable the screens simply
 * show no request state instead of failing. RLS limits rows to the buyer and the seller of each conversation.
 */
export async function getShareForItem(itemId: number, buyerId: string): Promise<{ conversationId: number; status: ContactShareStatus } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('contact_shares')
    .select('conversation_id, status')
    .eq('item_id', itemId)
    .eq('buyer_id', buyerId)
    .maybeSingle();
  if (error || !data) return null;
  return { conversationId: data.conversation_id, status: data.status };
}

export async function getSharesByConversation(): Promise<Record<number, ContactShareStatus>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('contact_shares').select('conversation_id, status');
  if (error || !data) return {};
  return Object.fromEntries(data.map((r) => [r.conversation_id, r.status]));
}
