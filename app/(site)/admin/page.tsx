import type { Metadata } from 'next';
import { getCurrentUser } from '@/lib/auth/session';
import { requireAdmin } from '@/lib/staff/auth';
import { searchUsers } from '@/lib/staff/queries';
import StaffNav from '@/components/staff/StaffNav';
import ModerationPanel from '@/components/staff/ModerationPanel';

export const metadata: Metadata = { title: 'Admin · users' };
export const dynamic = 'force-dynamic';

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const role = await requireAdmin();
  const me = await getCurrentUser();
  const q = ((await searchParams).q ?? '').slice(0, 100);
  const users = q.trim() ? await searchUsers(q) : [];

  return (
    <div className="messages-shell">
      <header>
        <h1 className="font-display">ADMIN</h1>
        <p className="sub font-mono">Find a student by name or email</p>
      </header>
      <StaffNav role={role} current="users" />
      <form action="/admin" role="search" className="staff-search">
        <input type="search" name="q" className="field-input" defaultValue={q} placeholder="Name or email…" aria-label="Search users" maxLength={100} />
        <button type="submit" className="btn btn-dark">SEARCH</button>
      </form>

      {q.trim() && users.length === 0 && <div className="empty-state"><h2 className="font-display">NO MATCHES</h2><p>Nobody matches &ldquo;{q}&rdquo;.</p></div>}
      {users.map((u) => (
        <details key={u.id} className="staff-card">
          <summary>
            <strong>{u.display_name}</strong> · {u.email} · {u.role} · <span className={`staff-status ${u.effective_status}`}>{u.effective_status}</span>
            {u.warning_count > 0 ? ` · ${u.warning_count} warning${u.warning_count === 1 ? '' : 's'}` : ''}
          </summary>
          <ModerationPanel
            actingRole={role}
            selfId={me?.id ?? ''}
            user={{ id: u.id, displayName: u.display_name, role: u.role, effectiveStatus: u.effective_status }}
            showRoleChange
          />
        </details>
      ))}
    </div>
  );
}
