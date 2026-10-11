import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/staff/auth';
import { getAuditLogs, getSecurityEvents, parsePage } from '@/lib/staff/queries';
import { timeAgo } from '@/lib/format';
import StaffNav from '@/components/staff/StaffNav';

export const metadata: Metadata = { title: 'Admin · audit log' };
export const dynamic = 'force-dynamic';

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ view?: string; page?: string }> }) {
  const role = await requireAdmin();
  const sp = await searchParams;
  const view = sp.view === 'security' ? 'security' : 'audit';
  const page = parsePage(sp.page);
  const audit = view === 'audit' ? await getAuditLogs(page) : null;
  const events = view === 'security' ? await getSecurityEvents(page) : null;
  const total = (audit ?? events)?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / 50));
  const href = (p: number) => `/admin/audit?view=${view}${p > 1 ? `&page=${p}` : ''}`;

  return (
    <div className="messages-shell">
      <header>
        <h1 className="font-display">AUDIT LOG</h1>
        <p className="sub font-mono">Append-only. Entries cannot be edited or deleted.</p>
      </header>
      <StaffNav role={role} current="audit" />
      <div className="staff-filters">
        <Link href="/admin/audit?view=audit" className={`staff-tab${view === 'audit' ? ' active' : ''}`}>Staff actions</Link>
        <Link href="/admin/audit?view=security" className={`staff-tab${view === 'security' ? ' active' : ''}`}>Security events</Link>
      </div>

      <div className="staff-table-wrap">
        {audit && (
          <table className="staff-table">
            <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Target</th><th>Reason</th><th>Source</th></tr></thead>
            <tbody>
              {audit.rows.map((r) => (
                <tr key={r.id}>
                  <td suppressHydrationWarning title={r.created_at}>{timeAgo(r.created_at)}</td>
                  <td>{r.actor_name ?? 'system'} ({r.actor_role})</td>
                  <td>{r.action}</td>
                  <td>{r.target_type ? `${r.target_type} ${r.target_id ?? ''}` : ''}</td>
                  <td>{r.reason ?? ''}</td>
                  <td>{r.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {events && (
          <table className="staff-table">
            <thead><tr><th>When</th><th>Event</th><th>Severity</th><th>User</th><th>Source</th></tr></thead>
            <tbody>
              {events.rows.map((r) => (
                <tr key={r.id}>
                  <td suppressHydrationWarning title={r.created_at}>{timeAgo(r.created_at)}</td>
                  <td>{r.event_type}</td>
                  <td>{r.severity}</td>
                  <td>{r.user_id ?? ''}</td>
                  <td>{r.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {total === 0 && <div className="empty-state"><h2 className="font-display">NOTHING LOGGED YET</h2></div>}

      {pages > 1 && (
        <nav className="pagination" aria-label="Pagination">
          <Link className="btn btn-outline" href={href(page - 1)} aria-disabled={page <= 1} tabIndex={page <= 1 ? -1 : 0}>← Prev</Link>
          <span aria-current="page">Page {page} of {pages}</span>
          <Link className="btn btn-outline" href={href(page + 1)} aria-disabled={page >= pages} tabIndex={page >= pages ? -1 : 0}>Next →</Link>
        </nav>
      )}
    </div>
  );
}
