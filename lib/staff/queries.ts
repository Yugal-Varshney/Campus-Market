import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

type ReportRow = Database['public']['Tables']['reports']['Row'];
export type StaffUser = Database['public']['Functions']['staff_get_user']['Returns'][number];
export type AuditRow = Database['public']['Tables']['audit_logs']['Row'];
export type SecurityEventRow = Database['public']['Tables']['security_events']['Row'];
export type ModerationActionRow = Database['public']['Tables']['moderation_actions']['Row'];

export const STAFF_PAGE_SIZE = 25;
export type ReportFilter = 'open' | 'pending' | 'reviewing' | 'resolved' | 'dismissed' | 'all';
export const REPORT_FILTERS: { key: ReportFilter; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'pending', label: 'Unclaimed' },
  { key: 'reviewing', label: 'In review' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'dismissed', label: 'Dismissed' },
  { key: 'all', label: 'All' },
];
export const parseReportFilter = (v: unknown): ReportFilter => (REPORT_FILTERS.some((f) => f.key === v) ? (v as ReportFilter) : 'open');
export const parsePage = (v: unknown): number => { const n = Number(v); return Number.isInteger(n) && n >= 1 && n <= 10_000 ? n : 1; };

const REPORT_COLUMNS = 'id, reporter_id, reported_user_id, listing_id, reason, description, status, reviewed_by, reviewed_at, target_snapshot, created_at';

/** Report queue. Staff read access comes from the "reports staff read all" policy (migration 007). */
export async function getReports(filter: ReportFilter, page: number): Promise<{ rows: ReportRow[]; total: number }> {
  const supabase = await createClient();
  let q = supabase.from('reports').select(REPORT_COLUMNS, { count: 'exact' });
  if (filter === 'open') q = q.in('status', ['pending', 'reviewing']);
  else if (filter !== 'all') q = q.eq('status', filter);
  const from = (page - 1) * STAFF_PAGE_SIZE;
  const { data, count, error } = await q
    .order('created_at', { ascending: filter === 'open' || filter === 'pending' })
    .range(from, from + STAFF_PAGE_SIZE - 1);
  if (error) throw new Error('Could not load reports.');
  return { rows: (data ?? []) as unknown as ReportRow[], total: count ?? 0 };
}

export interface ReportDetail {
  report: ReportRow;
  listing: { id: number; title: string; sellerName: string; status: string; moderationStatus: string; moderationReason: string | null; price: number } | null;
  reportedUser: StaffUser | null;
  reporter: StaffUser | null;
  otherReportsAboutUser: number;
  history: ModerationActionRow[];
}

export async function getReportDetail(id: number): Promise<ReportDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase.from('reports').select(REPORT_COLUMNS).eq('id', id).maybeSingle();
  if (!data) return null;
  const report = data as unknown as ReportRow;

  const [listingRes, reportedRes, reporterRes, othersRes, historyRes] = await Promise.all([
    report.listing_id
      ? supabase.from('items').select('id, title, seller_name, status, moderation_status, moderation_reason, price').eq('id', report.listing_id).maybeSingle()
      : Promise.resolve({ data: null }),
    report.reported_user_id ? supabase.rpc('staff_get_user', { p_user_id: report.reported_user_id }) : Promise.resolve({ data: null }),
    report.reporter_id ? supabase.rpc('staff_get_user', { p_user_id: report.reporter_id }) : Promise.resolve({ data: null }),
    report.reported_user_id
      ? supabase.from('reports').select('id', { count: 'exact', head: true }).eq('reported_user_id', report.reported_user_id).neq('id', report.id)
      : Promise.resolve({ count: 0 }),
    supabase.from('moderation_actions')
      .select('id, created_at, actor_id, actor_role, action, target_user_id, listing_id, report_id, reason')
      .or(`report_id.eq.${report.id}${report.reported_user_id ? `,target_user_id.eq.${report.reported_user_id}` : ''}${report.listing_id ? `,listing_id.eq.${report.listing_id}` : ''}`)
      .order('created_at', { ascending: false })
      .limit(15),
  ]);

  const l = listingRes.data as { id: number; title: string; seller_name: string; status: string; moderation_status: string; moderation_reason: string | null; price: number } | null;
  return {
    report,
    listing: l ? { id: l.id, title: l.title, sellerName: l.seller_name, status: l.status, moderationStatus: l.moderation_status, moderationReason: l.moderation_reason, price: Number(l.price) } : null,
    reportedUser: (reportedRes.data as StaffUser[] | null)?.[0] ?? null,
    reporter: (reporterRes.data as StaffUser[] | null)?.[0] ?? null,
    otherReportsAboutUser: othersRes.count ?? 0,
    history: (historyRes.data ?? []) as unknown as ModerationActionRow[],
  };
}

/** Admin only (the database function refuses everyone else). */
export async function searchUsers(query: string): Promise<StaffUser[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_search_users', { p_query: query.slice(0, 100), p_limit: 20, p_offset: 0 });
  if (error) throw new Error('Could not search users.');
  return data ?? [];
}

const AUDIT_COLUMNS = 'id, created_at, actor_id, actor_role, actor_name, action, category, target_type, target_id, reason, source';

export async function getAuditLogs(page: number): Promise<{ rows: AuditRow[]; total: number }> {
  const supabase = await createClient();
  const from = (page - 1) * 50;
  const { data, count, error } = await supabase.from('audit_logs').select(AUDIT_COLUMNS, { count: 'exact' }).order('id', { ascending: false }).range(from, from + 49);
  if (error) throw new Error('Could not load the audit log.');
  return { rows: (data ?? []) as unknown as AuditRow[], total: count ?? 0 };
}

export async function getSecurityEvents(page: number): Promise<{ rows: SecurityEventRow[]; total: number }> {
  const supabase = await createClient();
  const from = (page - 1) * 50;
  const { data, count, error } = await supabase.from('security_events').select('id, created_at, user_id, event_type, severity, source', { count: 'exact' }).order('id', { ascending: false }).range(from, from + 49);
  if (error) throw new Error('Could not load security events.');
  return { rows: (data ?? []) as unknown as SecurityEventRow[], total: count ?? 0 };
}
