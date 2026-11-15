import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/session';
import { buildAccountNotice, type AccountNotice } from './notice';

export const getAccountNotice = cache(async (): Promise<AccountNotice | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('account_status, suspended_until, suspension_reason, last_warning_at, last_warning_reason')
    .eq('id', user.id)
    .maybeSingle();
  return buildAccountNotice(data);
});
