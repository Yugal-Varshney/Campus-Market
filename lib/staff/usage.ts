import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { UsageSummary } from './usage-format';

export async function getUsageSummary(days: number): Promise<UsageSummary | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('admin_usage_summary', { p_days: days });
    if (error || !data) return null;
    return data as unknown as UsageSummary;
  } catch {
    return null;
  }
}
