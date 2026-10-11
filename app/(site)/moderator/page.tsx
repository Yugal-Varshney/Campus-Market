import type { Metadata } from 'next';
import Link from 'next/link';
import { requireStaff } from '@/lib/staff/auth';
import { REPORT_FILTERS, STAFF_PAGE_SIZE, getReports, parsePage, parseReportFilter } from '@/lib/staff/queries';
import { REPORT_REASONS } from '@/lib/constants';
import { timeAgo } from '@/lib/format';
import StaffNav from '@/components/staff/StaffNav';

export const metadata: Metadata = { title: 'Moderation' };
export const dynamic = 'force-dynamic';

type SP = Promise<{ status?: string; page?: string }>;

export default async function ModeratorPage({ searchParams }: { searchParams: SP }) {
  const role = await requireStaff();
  const sp = await searchParams;
  const filter = parseReportFilter(sp.status);
  const page = parsePage(sp.page);
  const { rows, total } = await getReports(filter, page);
  const pages = Math.max(1, Math.ceil(total / STAFF_PAGE_SIZE));
  const href = (p: number) => `/moderator?status=${filter}${p > 1 ? `&page=${p}` : ''}`;
  const reasonLabel = (v: string) => REPORT_REASONS.find((r) => r.value === v)?.label ?? v;

  return (
    <div className="messages-shell">
      <header>
        <h1 className="font-display">MODERATION</h1>
        <p className="sub font-mono">{role} · {total} report{total === 1 ? '' : 's'} in this view</p>
      </header>
      <StaffNav role={role} current="reports" />
      <div className="staff-filters" role="tablist" aria-label="Report status">
        {REPORT_FILTERS.map((f) => (
          <Link key={f.key} href={`/moderator?status=${f.key}`} className={`staff-tab${filter === f.key ? ' active' : ''}`} aria-current={filter === f.key ? 'page' : undefined}>{f.label}</Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="empty-state"><h2 className="font-display">NOTHING HERE</h2><p>No reports match this view.</p></div>
      ) : (
        <div className="staff-table-wrap">
          <table className="staff-table">
            <thead><tr><th>#</th><th>Reported</th><th>Reason</th><th>Status</th><th>When</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><Link href={`/moderator/reports/${r.id}`}>#{r.id}</Link></td>
                  <td>{r.target_snapshot?.type === 'listing' ? `Listing: ${r.target_snapshot.listing_title ?? ''}` : `User: ${r.target_snapshot?.reported_user_name ?? ''}`}</td>
                  <td>{reasonLabel(r.reason)}</td>
                  <td><span className={`staff-status ${r.status}`}>{r.status}</span></td>
                  <td suppressHydrationWarning>{timeAgo(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
