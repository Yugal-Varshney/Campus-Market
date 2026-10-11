import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { requireStaff } from '@/lib/staff/auth';
import { getReportDetail } from '@/lib/staff/queries';
import { REPORT_REASONS } from '@/lib/constants';
import { formatPrice, timeAgo } from '@/lib/format';
import StaffNav from '@/components/staff/StaffNav';
import ModerationPanel from '@/components/staff/ModerationPanel';

export const metadata: Metadata = { title: 'Report' };
export const dynamic = 'force-dynamic';

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const role = await requireStaff();
  const user = await getCurrentUser();
  const { id } = await params;
  const n = Number(id);
  if (!Number.isInteger(n) || n < 1) notFound();
  const detail = await getReportDetail(n);
  if (!detail || !user) notFound();
  const { report, listing, reportedUser, reporter, otherReportsAboutUser, history } = detail;
  const reasonLabel = REPORT_REASONS.find((r) => r.value === report.reason)?.label ?? report.reason;

  return (
    <div className="messages-shell">
      <header>
        <h1 className="font-display">REPORT #{report.id}</h1>
        <p className="sub font-mono"><span className={`staff-status ${report.status}`}>{report.status}</span> · {reasonLabel} · <span suppressHydrationWarning>{timeAgo(report.created_at)}</span></p>
      </header>
      <StaffNav role={role} current="reports" />
      <p><Link href="/moderator">← Back to reports</Link></p>

      <section className="staff-card">
        <h2>What was reported</h2>
        {report.description ? <blockquote className="staff-quote">{report.description}</blockquote> : <p className="mod-hint">The reporter added no details.</p>}
        <p className="mod-hint">Reporter: {reporter ? reporter.display_name : 'account removed'}{reportedUser && otherReportsAboutUser > 0 ? ` · ${otherReportsAboutUser} other report${otherReportsAboutUser === 1 ? '' : 's'} about this person` : ''}</p>
      </section>

      {listing ? (
        <section className="staff-card">
          <h2>Listing</h2>
          <p><Link href={`/marketplace/${listing.id}`}>{listing.title}</Link> · {formatPrice(listing.price)} · by {listing.sellerName}</p>
          <p className="mod-hint">Marketplace status: {listing.status} · Moderation: {listing.moderationStatus}{listing.moderationReason ? ` (${listing.moderationReason})` : ''}</p>
        </section>
      ) : report.target_snapshot?.type === 'listing' ? (
        <section className="staff-card"><h2>Listing</h2><p className="mod-hint">&ldquo;{report.target_snapshot.listing_title}&rdquo; no longer exists.</p></section>
      ) : null}

      {reportedUser ? (
        <section className="staff-card">
          <h2>Person reported</h2>
          <p>{reportedUser.display_name} · role {reportedUser.role} · account {reportedUser.effective_status} · {reportedUser.warning_count} warning{reportedUser.warning_count === 1 ? '' : 's'}{reportedUser.email ? ` · ${reportedUser.email}` : ''}</p>
        </section>
      ) : (
        <section className="staff-card"><h2>Person reported</h2><p className="mod-hint">The account no longer exists.</p></section>
      )}

      <section className="staff-card">
        <h2>Actions</h2>
        <ModerationPanel
          actingRole={role}
          selfId={user.id}
          report={{ id: report.id, status: report.status }}
          listing={listing ? { id: listing.id, moderationStatus: listing.moderationStatus } : null}
          user={reportedUser ? { id: reportedUser.id, displayName: reportedUser.display_name, role: reportedUser.role, effectiveStatus: reportedUser.effective_status } : null}
        />
      </section>

      {history.length > 0 && (
        <section className="staff-card">
          <h2>Recent actions on this report, listing or person</h2>
          <ul className="staff-history">
            {history.map((h) => (
              <li key={h.id}><strong>{h.action.replace(/_/g, ' ')}</strong> by {h.actor_role} · <span suppressHydrationWarning>{timeAgo(h.created_at)}</span><br />{h.reason}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
