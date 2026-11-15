'use server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/session';
import { friendlyDbError } from '@/lib/errors';
import type { ContactShareStatus } from '@/types';

type Result = { status?: ContactShareStatus | null; error?: string };
const FALLBACK = 'That did not work. Please try again.';
const validId = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0;

export async function requestContact(conversationId: number): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { error: 'You need to sign in to continue.' };
  if (!validId(conversationId)) return { error: 'Conversation not found.' };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('request_contact', { p_conversation_id: conversationId });
  if (error) return { error: friendlyDbError(error.message, FALLBACK) };
  return { status: data as ContactShareStatus };
}

export async function answerContactRequest(conversationId: number, approve: boolean): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { error: 'You need to sign in to continue.' };
  if (!validId(conversationId) || typeof approve !== 'boolean') return { error: 'Conversation not found.' };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('respond_contact_request', { p_conversation_id: conversationId, p_approve: approve });
  if (error) return { error: friendlyDbError(error.message, FALLBACK) };
  return { status: data as ContactShareStatus };
}

export async function stopSharingContact(conversationId: number): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { error: 'You need to sign in to continue.' };
  if (!validId(conversationId)) return { error: 'Conversation not found.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('revoke_contact_share', { p_conversation_id: conversationId });
  if (error) return { error: friendlyDbError(error.message, FALLBACK) };
  return { status: 'revoked' };
}

export async function getShareStatus(conversationId: number): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { error: 'You need to sign in to continue.' };
  if (!validId(conversationId)) return { status: null };
  const supabase = await createClient();
  const { data, error } = await supabase.from('contact_shares').select('status').eq('conversation_id', conversationId).maybeSingle();
  if (error) return { error: FALLBACK };
  return { status: data?.status ?? null };
}
