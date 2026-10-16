import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/staff/auth';
import { getUsageSummary } from '@/lib/staff/usage';
import { formatDelta, percent, type Pair } from '@/lib/staff/usage-format';
import StaffNav from '@/components/staff/StaffNav';

export const metadata: Metadata = { title: 'Admin · usage' };
export const dynamic = 'force-dynamic';

const RANGES = [7, 30, 90];

export default async function UsagePage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const role = await requireAdmin();
  const raw = Number((await searchParams).days);
  const days = RANGES.includes(raw) ? raw : 30;
  const data = await getUsageSummary(days);

  const stat = (label: string, p: Pair) => (
    <div className="stat-box usage-stat" key={label}>
      <p className="stat-label">{label}</p>
      <p className="stat-value">{p.now}</p>
      <p className="usage-delta">{formatDelta(p.now, p.before)} vs previous {days} days ({p.before})</p>
    </div>
  );
  const ratio = (label: string, part: number, whole: number, hint: string) => {
    const v = percent(part, whole);
    return (
      <div className="stat-box usage-stat" key={label}>
        <p className="stat-label">{label}</p>
        <p className="stat-value">{v === null ? '—' : `${v}%`}</p>
        <p className="usage-delta">{part} of {whole} · {hint}</p>
      </div>
    );
  };

  return (
    <div className="messages-shell">
      <header>
        <h1 className="font-display">ADMIN</h1>
        <p className="sub font-mono">How students are using Campus Market</p>
      </header>
      <StaffNav role={role} current="usage" />

      <nav className="usage-range" aria-label="Time range">
        {RANGES.map((r) => (
          <Link key={r} href={`/admin/usage?days=${r}`} className={`chip${r === days ? ' is-active' : ''}`} aria-current={r === days ? 'true' : undefined}>Last {r} days</Link>
        ))}
      </nav>

      {!data ? (
        <div className="empty-state solid" role="alert"><h2 className="font-display">Couldn&apos;t load</h2><p>Run migration 013 in Supabase, then refresh this page.</p></div>
      ) : (
        <>
          <section aria-labelledby="usage-activity">
            <h2 id="usage-activity" className="usage-heading">Activity</h2>
            <div className="usage-grid">
              {stat('New students', data.new_students)}
              {stat('Active students', data.active_students)}
              {stat('Listings posted', data.listings_posted)}
              {stat('Chats started', data.chats_started)}
              {stat('Messages sent', data.messages_sent)}
              {stat('Listings saved', data.listings_saved)}
              {stat('Searches saved', data.searches_saved)}
              {stat('Contact requests', data.contact_requests)}
            </div>
            <p className="usage-note">Active students did something that leaves a record: posted, chatted, messaged, or saved a listing or search. Browsing alone is not counted.</p>
          </section>

          <section aria-labelledby="usage-health">
            <h2 id="usage-health" className="usage-heading">Is the marketplace working?</h2>
            <div className="usage-grid">
              {ratio('Chats the seller answered', data.health.chats_answered, data.health.chats_started, 'buyers who got a reply')}
              {ratio('Contact requests approved', data.health.contact_approved, data.health.contact_requests, 'sellers willing to share')}
              {ratio('Listings with no chat after 14 days', data.health.stale_listings, data.health.active_listings, 'may need a better photo or price')}
              <div className="stat-box usage-stat"><p className="stat-label">Sold or rented, all time</p><p className="stat-value">{data.health.sold_or_rented_total}</p><p className="usage-delta">listings marked done by sellers</p></div>
            </div>
          </section>

          <section aria-labelledby="usage-daily">
            <h2 id="usage-daily" className="usage-heading">Day by day (UTC, up to the last 30 days)</h2>
            <div className="usage-table-wrap">
              <table className="usage-table">
                <thead><tr><th scope="col">Day</th><th scope="col">Listings</th><th scope="col">Chats</th><th scope="col">Messages</th></tr></thead>
                <tbody>
                  {[...data.daily].reverse().map((r) => (
                    <tr key={r.day}><th scope="row">{r.day}</th><td>{r.listings}</td><td>{r.chats}</td><td>{r.messages}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
